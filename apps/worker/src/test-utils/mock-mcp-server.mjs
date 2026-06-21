/**
 * Minimal MCP server for testing — responds to JSON-RPC over stdio.
 * Run: node mock-mcp-server.mjs
 */
import { createInterface } from 'node:readline';

const TOOLS = [
  { name: 'echo', description: 'Echo arguments back as text', inputSchema: { type: 'object' } },
];

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    let result;
    if (msg.method === 'initialize') {
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mock-mcp', version: '1.0.0' },
      };
    } else if (msg.method === 'tools/list') {
      result = { tools: TOOLS };
    } else if (msg.method === 'tools/call') {
      const args = msg.params?.arguments ?? {};
      result = { content: [{ type: 'text', text: JSON.stringify(args) }] };
    } else {
      result = {};
    }
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) + '\n');
  } catch {
    // ignore parse errors
  }
});
