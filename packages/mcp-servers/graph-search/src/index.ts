#!/usr/bin/env node
/**
 * MCP server: graph-search
 *
 * Bridges the knowledge graph to the MCP protocol. `tools/list` is static;
 * `tools/call` forwards to the worker's authenticated HTTP API.
 * (FIX-006, G9 — depends on FIX-008 GraphRepo + /graph routes.)
 */

import { createWorkerClient, runJsonRpcServer } from '@wolfkrow/mcp-shared';
import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const tools: McpTool[] = [
  {
    name: 'graph_neighborhood',
    description: 'Get the neighborhood (BFS) around a knowledge-graph node by id.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The graph node id to expand.' },
        depth: { type: 'number', default: 1, description: 'BFS depth (default 1).' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'graph_full',
    description: 'Get the full knowledge graph (all nodes and edges) for the user.',
    inputSchema: { type: 'object', properties: {} },
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
      if (name === 'graph_neighborhood') {
        const raw = args['nodeId'];
        const nodeId = typeof raw === 'string' ? raw : String(raw ?? '');
        const depth = typeof args['depth'] === 'number' ? args['depth'] : 1;
        return text(await worker.get(`/graph/${encodeURIComponent(nodeId)}?depth=${depth}`));
      }
      if (name === 'graph_full') {
        return text(await worker.get('/graph'));
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
