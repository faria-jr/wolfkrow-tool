import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['GOOGLE_DRIVE_TOKEN'];
});

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('google-drive MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list_files, get_file, share_file', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_files', 'get_file', 'share_file']));
  });

  it('list_files calls Drive /files endpoint', async () => {
    process.env['GOOGLE_DRIVE_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ files: [] }));
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_files', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain('https://www.googleapis.com/drive/v3/files');
    expect(url).toContain('pageSize=20');
  });

  it('list_files passes query through to q parameter', async () => {
    process.env['GOOGLE_DRIVE_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ files: [] }));
    await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'list_files', arguments: { query: "name contains 'report'" } },
      },
      handlers,
    );
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain('q=name+contains+%27report%27');
  });

  it('get_file requires id', async () => {
    process.env['GOOGLE_DRIVE_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_file', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when token missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_files', arguments: {} } },
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
