import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['WOLFKROW_AUTH_TOKEN'];
  delete process.env['WOLFKROW_WEB_URL'];
});

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('local-agents MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list, get, create, delete', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_agents', 'get_agent', 'create_agent', 'delete_agent']),
    );
  });

  it('list_agents GETs /api/agents', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ agents: [] }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_agents', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('http://localhost:3000/api/agents');
  });

  it('create_agent POSTs to /api/agents', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ id: 'new' }));
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'create_agent',
          arguments: { name: 'helper', runtime: 'claude-compat', provider: 'zai' },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe('http://localhost:3000/api/agents');
    expect(call?.[1]?.method).toBe('POST');
  });

  it('uses WOLFKROW_WEB_URL override', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    process.env['WOLFKROW_WEB_URL'] = 'http://my-web:8888/';
    vi.stubGlobal('fetch', makeFetchOk({ agents: [] }));
    await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_agents', arguments: {} } },
      handlers,
    );
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('http://my-web:8888/api/agents');
  });

  it('get_agent requires id', async () => {
    process.env['WOLFKROW_AUTH_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_agent', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when auth token missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_agents', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('unknown tool returns isError', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'nope', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
