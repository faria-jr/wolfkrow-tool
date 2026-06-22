#!/usr/bin/env node
/**
 * MCP server: knowledge-base
 *
 * Semantic search over the user knowledge base. `tools/list` is static;
 * `tools/call` forwards to the worker's authenticated POST /knowledge/search.
 * (FIX-006, G9 — depends on FIX-002 working cosine search.)
 */

import { createWorkerClient, runJsonRpcServer } from '@wolfkrow/mcp-shared';
import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const tools: McpTool[] = [
  {
    name: 'search_knowledge',
    description: 'Semantic search over the user knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query.' },
        limit: { type: 'number', default: 5, description: 'Max results (default 5).' },
      },
      required: ['query'],
    },
  },
];

const worker = createWorkerClient();

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'search_knowledge') {
        const query = typeof args['query'] === 'string' ? args['query'] : String(args['query'] ?? '');
        const limit = typeof args['limit'] === 'number' ? args['limit'] : undefined;
        const body = limit !== undefined ? { query, limit } : { query };
        return text(await worker.post('/knowledge/search', body));
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
