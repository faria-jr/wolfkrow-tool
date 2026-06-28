#!/usr/bin/env node
/**
 * MCP server: memory-search
 *
 * Bridges to the worker's authenticated memory API (mounted under /api).
 * `tools/list` is static; `tools/call` forwards to GET/POST /api/memory*.
 */

import {
  createWorkerClient,
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
  type WorkerClient,
} from '@wolfkrow/mcp-shared';

const tools: McpTool[] = [
  {
    name: 'search_memories',
    description: 'Semantic search across stored memories. Returns matches with distance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        limit: { type: 'number', description: 'Maximum results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_memories',
    description: 'List all memories for the current user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_memory',
    description: 'Add a new memory entry.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Memory content' },
        source: {
          type: 'string',
          enum: ['conversation', 'compaction', 'user', 'agent'],
          description: 'Where the memory came from',
        },
        importance: { type: 'number', description: 'Importance 0-100 (default 50)' },
      },
      required: ['content'],
    },
  },
];

function getWorker(): WorkerClient {
  return createWorkerClient();
}

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function searchMemories(args: Record<string, unknown>): Promise<McpToolResult> {
  const query = String(args['query'] ?? '');
  if (!query) return failure('search_memories requires a "query" argument');
  const body: Record<string, unknown> = { query };
  if (args['limit'] !== undefined) body['limit'] = args['limit'];
  return text(await getWorker().post('/api/memory/search', body));
}

async function listMemories(): Promise<McpToolResult> {
  return text(await getWorker().get('/api/memory'));
}

async function addMemory(args: Record<string, unknown>): Promise<McpToolResult> {
  const content = String(args['content'] ?? '');
  if (!content) return failure('add_memory requires a "content" argument');
  const body: Record<string, unknown> = { content };
  if (args['source'] !== undefined) body['source'] = args['source'];
  if (args['importance'] !== undefined) body['importance'] = args['importance'];
  return text(await getWorker().post('/api/memory', body));
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'search_memories') return await searchMemories(args);
      if (name === 'list_memories') return await listMemories();
      if (name === 'add_memory') return await addMemory(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
