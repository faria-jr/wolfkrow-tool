import type { Readable, Writable } from 'node:stream';

import type { McpHandlers } from './types.js';

/**
 * Minimal MCP JSON-RPC server (stdio transport).
 *
 * The worker's McpManager speaks newline-delimited JSON-RPC 2.0 over the
 * child process stdin/stdout. We implement just the three methods the manager
 * uses: `initialize`, `tools/list`, `tools/call`. Everything else is a
 * method-not-found error. Notifications (no `id`) get no response.
 */

const PROTOCOL_VERSION = '2024-11-05';

export const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INTERNAL_ERROR: -32603,
} as const;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export function createResponse(id: number | string, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function createErrorResponse(
  id: number | string,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Handle a single parsed JSON-RPC message. Returns the response to write, or
 * `null` for notifications (which must not be answered). Pure + async so it is
 * unit-testable without any stream plumbing.
 */
export async function handleRpcMessage(
  msg: JsonRpcRequest,
  handlers: McpHandlers
): Promise<JsonRpcResponse | null> {
  const id = msg.id;
  if (id === undefined) return null;

  switch (msg.method) {
    case 'initialize':
      return createResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'wolfkrow-mcp', version: '1.0.0' },
      });

    case 'tools/list':
      return createResponse(id, { tools: handlers.listTools() });

    case 'tools/call': {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name) {
        return createErrorResponse(id, ERROR_CODES.INVALID_REQUEST, 'tools/call requires a "name"');
      }
      const result = await handlers.callTool(params.name, params.arguments ?? {});
      return createResponse(id, result);
    }

    default:
      return createErrorResponse(
        id,
        ERROR_CODES.METHOD_NOT_FOUND,
        `Method not found: ${msg.method}`
      );
  }
}

/**
 * Wire a JSON-RPC server to a pair of streams. Reads NDJSON from `input`,
 * dispatches each line, and writes responses to `output`. Malformed lines and
 * handler exceptions are turned into error responses rather than crashing.
 */
export function runJsonRpcServer(input: Readable, output: Writable, handlers: McpHandlers): void {
  let buffer = '';
  input.setEncoding('utf8');
  input.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) void processLine(line, handlers, output);
    }
  });
}

async function processLine(line: string, handlers: McpHandlers, output: Writable): Promise<void> {
  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(line) as JsonRpcRequest;
  } catch {
    write(output, createErrorResponse(0, ERROR_CODES.PARSE_ERROR, 'Parse error'));
    return;
  }

  try {
    const response = await handleRpcMessage(msg, handlers);
    if (response) write(output, response);
  } catch (err) {
    if (msg.id !== undefined) {
      write(
        output,
        createErrorResponse(msg.id, ERROR_CODES.INTERNAL_ERROR, (err as Error).message)
      );
    }
  }
}

function write(output: Writable, response: JsonRpcResponse): void {
  output.write(`${JSON.stringify(response)}\n`);
}
