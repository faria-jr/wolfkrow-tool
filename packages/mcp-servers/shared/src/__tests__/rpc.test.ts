import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { handleRpcMessage, runJsonRpcServer } from '../rpc';
import type { McpHandlers, McpTool } from '../types';

function makeHandlers(overrides: Partial<McpHandlers> = {}): McpHandlers {
  return {
    listTools: () => [],
    callTool: vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'ok' }] })),
    ...overrides,
  };
}

const tool = (name: string): McpTool => ({ name, description: 'd', inputSchema: {} });

describe('handleRpcMessage', () => {
  it('answers initialize with protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, makeHandlers());
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: expect.objectContaining({
        protocolVersion: expect.any(String),
        capabilities: { tools: {} },
      }),
    });
  });

  it('answers tools/list with the handler-declared tools', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      makeHandlers({ listTools: () => [tool('foo')] }),
    );
    expect(res?.result).toEqual({ tools: [tool('foo')] });
  });

  it('forwards name+arguments to callTool and returns its result', async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'r' }], isError: true }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 't', arguments: { x: 1 } } },
      makeHandlers({ callTool }),
    );
    expect(callTool).toHaveBeenCalledWith('t', { x: 1 });
    expect(res?.result).toEqual({ content: [{ type: 'text', text: 'r' }], isError: true });
  });

  it('defaults missing arguments to an empty object', async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'r' }] }));
    await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 't' } },
      makeHandlers({ callTool }),
    );
    expect(callTool).toHaveBeenCalledWith('t', {});
  });

  it('rejects tools/call without a tool name', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} },
      makeHandlers(),
    );
    expect(res?.error?.code).toBe(-32600);
  });

  it('returns method-not-found for unknown methods', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 4, method: 'nope' }, makeHandlers());
    expect(res?.error?.code).toBe(-32601);
    expect(res?.error?.message).toMatch(/nope/);
  });

  it('returns null for notifications (requests without an id)', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      makeHandlers(),
    );
    expect(res).toBeNull();
  });
});

describe('runJsonRpcServer', () => {
  it('reads NDJSON from the input stream and writes one response line per request', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c: Buffer) => chunks.push(c.toString()));

    runJsonRpcServer(
      input,
      output,
      makeHandlers({ listTools: () => [tool('t')] }),
    );

    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })}\n`);
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
    input.write('not valid json\n');
    input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Responses are written asynchronously, so order is not guaranteed —
    // index them by id instead of asserting position.
    const byId = new Map<number, { result?: unknown; error?: { code: number } }>();
    for (const line of chunks.join('').trim().split('\n')) {
      if (!line) continue;
      const parsed = JSON.parse(line) as { id: number; result?: unknown; error?: { code: number } };
      byId.set(parsed.id, parsed);
    }

    expect(byId.size).toBe(3);
    expect((byId.get(1)?.result as { protocolVersion: string }).protocolVersion).toBeTruthy();
    expect((byId.get(2)?.result as { tools: McpTool[] }).tools[0]?.name).toBe('t');
    expect(byId.get(0)?.error?.code).toBe(-32700);
  });
});
