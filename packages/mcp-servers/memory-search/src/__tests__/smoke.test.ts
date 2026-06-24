import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => vi.unstubAllGlobals());

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('memory-search MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns search, list and add tools', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['search_memories', 'list_memories', 'add_memory']),
    );
  });

  it('search_memories posts query to /api/memory/search', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ results: [] }));
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'search_memories', arguments: { query: 'llm settings' } },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe('http://localhost:4000/api/memory/search');
  });

  it('list_memories GETs /api/memory', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ memories: [] }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_memories', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe('http://localhost:4000/api/memory');
  });

  it('add_memory requires content', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'add_memory', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when auth token missing', async () => {
    delete process.env['WOLFKROW_AUTH_TOKEN'];
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_memories', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('unknown tool returns isError', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
