/**
 * Shared MCP types — the JSON-RPC contract used by every built-in MCP server.
 *
 * Servers are thin stdio processes: the worker's McpManager spawns them, speaks
 * newline-delimited JSON-RPC, and they bridge to the worker's HTTP API. These
 * types are the only surface the servers share.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Handlers a concrete server provides. `listTools` is static metadata
 * (answered without any I/O); `callTool` bridges to the worker HTTP API.
 */
export interface McpHandlers {
  listTools(): McpTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
}
