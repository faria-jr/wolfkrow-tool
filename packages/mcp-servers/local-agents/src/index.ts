#!/usr/bin/env node
/**
 * MCP server: local-agents
 *
 * CRUD over Wolfkrow agents via the web API. The web app owns agent storage
 * (apps/web/app/api/agents); this MCP bridges to it.
 * Override the web URL via WOLFKROW_WEB_URL (default http://localhost:3000).
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const DEFAULT_WEB_URL = 'http://localhost:3000';

function getWebUrl(): string {
  return (process.env['WOLFKROW_WEB_URL'] ?? DEFAULT_WEB_URL).replace(/\/$/, '');
}

function getToken(): string | undefined {
  return process.env['WOLFKROW_AUTH_TOKEN'];
}

const tools: McpTool[] = [
  {
    name: 'list_agents',
    description: 'List all agents defined for the current user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_agent',
    description: 'Fetch a single agent by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Agent id' } },
      required: ['id'],
    },
  },
  {
    name: 'create_agent',
    description: 'Create a new agent from a partial agent definition.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        runtime: {
          type: 'string',
          enum: ['cloud', 'local', 'codex', 'external', 'claude-compat'],
        },
        provider: { type: 'string' },
        model: { type: 'string' },
        systemPrompt: { type: 'string' },
        skills: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_agent',
    description: 'Delete an agent by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Agent id' } },
      required: ['id'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function webRequest(path: string, init: RequestInit): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('WOLFKROW_AUTH_TOKEN not set');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${getWebUrl()}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Web ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function listAgents(): Promise<McpToolResult> {
  return text(await webRequest('/api/agents', { method: 'GET' }));
}

async function getAgent(args: Record<string, unknown>): Promise<McpToolResult> {
  const id = String(args['id'] ?? '');
  if (!id) return failure('get_agent requires an "id" argument');
  return text(await webRequest(`/api/agents/${encodeURIComponent(id)}`, { method: 'GET' }));
}

async function createAgent(args: Record<string, unknown>): Promise<McpToolResult> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null) body[key] = value;
  }
  return text(await webRequest('/api/agents', { method: 'POST', body: JSON.stringify(body) }));
}

async function deleteAgent(args: Record<string, unknown>): Promise<McpToolResult> {
  const id = String(args['id'] ?? '');
  if (!id) return failure('delete_agent requires an "id" argument');
  return text(
    await webRequest(`/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  );
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_agents') return await listAgents();
      if (name === 'get_agent') return await getAgent(args);
      if (name === 'create_agent') return await createAgent(args);
      if (name === 'delete_agent') return await deleteAgent(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
