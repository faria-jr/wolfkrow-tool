import { spawn, type ChildProcess } from 'node:child_process';

import type { McpServerRepo, McpToolRegistryRepo } from '@wolfkrow/domain';

import { createLogger } from '../logger';

import type { McpTool, McpToolCallResult, JsonRpcResponse, PendingRequest } from './types';

const logger = createLogger('mcp-manager');
const DEFAULT_TIMEOUT_MS = 30_000;

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpManagerOptions {
  rpcTimeoutMs?: number;
  mcpServerRepo?: McpServerRepo;
  mcpToolRepo?: McpToolRegistryRepo;
}

export interface McpServerState {
  config: McpServerConfig;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'crashed';
  startedAt: Date;
  restarts: number;
  lastError?: string;
  tools: McpTool[];
  pendingRequests: Map<number, PendingRequest>;
  buffer: string;
}

export interface McpManager {
  start(config: McpServerConfig): Promise<McpServerState>;
  stop(name: string): Promise<void>;
  restart(name: string): Promise<McpServerState>;
  list(): McpServerState[];
  get(name: string): McpServerState | undefined;
  stopAll(): Promise<void>;
  call(serverName: string, method: string, params: unknown): Promise<unknown>;
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<McpToolCallResult>;
  listTools(serverName: string): McpTool[];
  listAllTools(): Map<string, McpTool[]>;
}

class McpManagerImpl implements McpManager {
  private readonly servers = new Map<string, McpServerState>();
  private readonly maxRestarts = 5;
  private readonly timeoutMs: number;
  private readonly mcpServerRepo: McpServerRepo | undefined;
  private readonly mcpToolRepo: McpToolRegistryRepo | undefined;
  private requestCounter = 0;

  constructor(opts: McpManagerOptions = {}) {
    this.timeoutMs = opts.rpcTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.mcpServerRepo = opts.mcpServerRepo;
    this.mcpToolRepo = opts.mcpToolRepo;
  }

  async start(config: McpServerConfig): Promise<McpServerState> {
    if (this.servers.has(config.name)) {
      throw new Error(`MCP server ${config.name} is already running`);
    }
    logger.info({ name: config.name }, 'Starting MCP server');
    const child = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const state: McpServerState = {
      config,
      process: child,
      status: 'starting',
      startedAt: new Date(),
      restarts: 0,
      tools: [],
      pendingRequests: new Map(),
      buffer: '',
    };
    this.servers.set(config.name, state);
    this.attachProcessHandlers(child, state);
    await this.initialize(state);
    state.status = 'running';
    return state;
  }

  private attachProcessHandlers(child: ChildProcess, state: McpServerState): void {
    const { name } = state.config;
    child.stdout?.on('data', (chunk: Buffer) => {
      this.handleStdoutChunk(state, chunk);
    });
    child.stderr?.on('data', (d: Buffer) => {
      logger.warn({ name, output: d.toString().trim() }, 'MCP stderr');
    });
    child.on('error', (err) => {
      logger.error({ name, err }, 'MCP process error');
      state.status = 'crashed';
      state.lastError = err.message;
      this.rejectPendingRequests(state, err);
    });
    child.on('exit', (code, signal) => {
      logger.warn({ name, code, signal }, 'MCP process exited');
      this.handleExit(state);
    });
  }

  private handleStdoutChunk(state: McpServerState, chunk: Buffer): void {
    state.buffer += chunk.toString();
    let nl: number;
    while ((nl = state.buffer.indexOf('\n')) !== -1) {
      const line = state.buffer.slice(0, nl).trim();
      state.buffer = state.buffer.slice(nl + 1);
      if (line) this.handleRpcMessage(state, line);
    }
  }

  private handleRpcMessage(state: McpServerState, line: string): void {
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line) as JsonRpcResponse;
    } catch {
      logger.warn({ name: state.config.name }, 'Invalid JSON-RPC line');
      return;
    }
    const pending = state.pendingRequests.get(msg.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    state.pendingRequests.delete(msg.id);
    if (msg.error) pending.reject(new Error(`MCP RPC error: ${msg.error.message}`));
    else pending.resolve(msg.result);
  }

  private rejectPendingRequests(state: McpServerState, reason: Error): void {
    for (const [id, pending] of state.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(reason);
      state.pendingRequests.delete(id);
    }
  }

  private async initialize(state: McpServerState): Promise<void> {
    await this.call(state.config.name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'wolfkrow', version: '1.0.0' },
    });
    const resp = (await this.call(state.config.name, 'tools/list', {})) as { tools?: McpTool[] };
    state.tools = resp.tools ?? [];
    this.persistToolRegistry(state);
  }

  private persistToolRegistry(state: McpServerState): void {
    if (!this.mcpServerRepo || !this.mcpToolRepo) return;
    try {
      const serverRecord = this.mcpServerRepo.findByName(state.config.name);
      if (!serverRecord) return;
      this.mcpToolRepo.upsertMany(
        serverRecord.id,
        state.tools.map((t) => ({
          name: t.name,
          ...(t.description !== undefined ? { description: t.description } : {}),
          ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
        }))
      );
    } catch {
      logger.warn({ name: state.config.name }, 'Failed to persist tool registry');
    }
  }

  async call(serverName: string, method: string, params: unknown): Promise<unknown> {
    const state = this.servers.get(serverName);
    if (!state) throw new Error(`MCP server ${serverName} is not running`);
    const id = ++this.requestCounter;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pendingRequests.delete(id);
        reject(new Error(`MCP call timeout: ${serverName}.${method}`));
      }, this.timeoutMs);
      state.pendingRequests.set(id, { resolve, reject, timer });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      state.process.stdin?.write(msg);
    });
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<McpToolCallResult> {
    return this.call(serverName, 'tools/call', {
      name: toolName,
      arguments: args,
    }) as Promise<McpToolCallResult>;
  }

  listTools(serverName: string): McpTool[] {
    const state = this.servers.get(serverName);
    if (!state) throw new Error(`MCP server ${serverName} is not running`);
    return state.tools;
  }

  listAllTools(): Map<string, McpTool[]> {
    const result = new Map<string, McpTool[]>();
    for (const [name, state] of this.servers) result.set(name, state.tools);
    return result;
  }

  private handleExit(state: McpServerState): void {
    const { name } = state.config;
    const reason = new Error(`MCP server ${name} exited unexpectedly`);
    this.rejectPendingRequests(state, reason);
    if (state.status !== 'stopped' && state.restarts < this.maxRestarts) {
      state.restarts++;
      const delayMs = Math.min(1_000 * 2 ** (state.restarts - 1), 30_000);
      logger.info({ name, attempt: state.restarts, delayMs }, 'Restarting MCP server with backoff');
      setTimeout(() => {
        void this.restart(name).catch((err) => {
          logger.error({ name, err }, 'MCP restart failed');
          state.status = 'crashed';
          state.lastError = (err as Error).message;
        });
      }, delayMs);
    } else {
      state.status = 'crashed';
    }
  }

  async stop(name: string): Promise<void> {
    const state = this.servers.get(name);
    if (!state) return;
    logger.info({ name }, 'Stopping MCP server');
    state.status = 'stopped';
    this.rejectPendingRequests(state, new Error(`MCP server ${name} stopped`));
    state.process.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        state.process.kill('SIGKILL');
        resolve();
      }, 5000);
      state.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    this.servers.delete(name);
  }

  async restart(name: string): Promise<McpServerState> {
    const state = this.servers.get(name);
    if (!state) throw new Error(`MCP server ${name} not found`);
    const config = state.config;
    await this.stop(name);
    return this.start(config);
  }

  list(): McpServerState[] {
    return Array.from(this.servers.values());
  }
  get(name: string): McpServerState | undefined {
    return this.servers.get(name);
  }
  async stopAll(): Promise<void> {
    await Promise.all(Array.from(this.servers.keys()).map((n) => this.stop(n)));
  }
}

export function createMcpManager(opts?: McpManagerOptions): McpManager {
  return new McpManagerImpl(opts);
}
