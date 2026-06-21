/**
 * MCP server process manager
 *
 * Spawns, monitors, and stops MCP servers as child processes.
 *
 * NOTE: bridge JSON-RPC stdio real (handshake/tools/list/call) chega na Fase N.3.
 * Hoje há spawn + auto-restart (sem backoff — gap G7, corrigido em N.3).
 */

import { spawn, type ChildProcess } from 'node:child_process';

import { createLogger } from '../logger';

const logger = createLogger('mcp-manager');

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpServerState {
  config: McpServerConfig;
  process: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'crashed';
  startedAt: Date;
  restarts: number;
  lastError?: string;
}

export interface McpManager {
  start(config: McpServerConfig): Promise<McpServerState>;
  stop(name: string): Promise<void>;
  restart(name: string): Promise<McpServerState>;
  list(): McpServerState[];
  get(name: string): McpServerState | undefined;
  stopAll(): Promise<void>;
}

class McpManagerImpl implements McpManager {
  private readonly servers = new Map<string, McpServerState>();
  private readonly maxRestarts = 5;

  async start(config: McpServerConfig): Promise<McpServerState> {
    if (this.servers.has(config.name)) {
      throw new Error(`MCP server ${config.name} is already running`);
    }

    logger.info({ name: config.name, command: config.command }, 'Starting MCP server');

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
    };
    this.servers.set(config.name, state);

    this.attachProcessHandlers(child, state);
    await this.waitForReady(child, state);
    return state;
  }

  private attachProcessHandlers(child: ChildProcess, state: McpServerState): void {
    const { name } = state.config;

    child.stdout?.on('data', (data: Buffer) => {
      logger.debug({ name, output: data.toString().trim() }, 'MCP stdout');
    });
    child.stderr?.on('data', (data: Buffer) => {
      logger.warn({ name, output: data.toString().trim() }, 'MCP stderr');
    });
    child.on('error', (error) => {
      logger.error({ name, err: error }, 'MCP process error');
      state.status = 'crashed';
      state.lastError = error.message;
    });
    child.on('exit', (code, signal) => {
      logger.warn({ name, code, signal }, 'MCP process exited');
      this.handleExit(state);
    });
  }

  private handleExit(state: McpServerState): void {
    const { name } = state.config;
    if (state.status !== 'stopped' && state.restarts < this.maxRestarts) {
      state.restarts++;
      logger.info({ name, attempt: state.restarts }, 'Restarting MCP server');
      void this.restart(name);
    } else {
      state.status = 'crashed';
    }
  }

  private waitForReady(child: ChildProcess, state: McpServerState): Promise<void> {
    const { name } = state.config;
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        state.status = 'running';
        resolve();
      }, 500);

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`MCP server ${name} exited with code ${code ?? 'unknown'}`));
      });
    });
  }

  async stop(name: string): Promise<void> {
    const state = this.servers.get(name);
    if (!state) return;

    logger.info({ name }, 'Stopping MCP server');
    state.status = 'stopped';
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
    await Promise.all(Array.from(this.servers.keys()).map((name) => this.stop(name)));
  }
}

export function createMcpManager(): McpManager {
  return new McpManagerImpl();
}
