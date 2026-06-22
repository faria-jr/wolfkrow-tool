#!/usr/bin/env node
/**
 * MCP server: wolfkrow-skills
 *
 * Lists the skills available to the user. `tools/list` is static;
 * `tools/call` forwards to the worker's authenticated GET /skills route.
 * (FIX-006, G9.)
 */

import { createWorkerClient, runJsonRpcServer } from '@wolfkrow/mcp-shared';
import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const tools: McpTool[] = [
  {
    name: 'list_skills',
    description: 'List all skills available to the user (built-in and custom).',
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
  callTool: async (name) => {
    try {
      if (name === 'list_skills') {
        return text(await worker.get('/skills'));
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
