import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['GOOGLE_SHEETS_TOKEN'];
});

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('google-sheets MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list_sheets, read_sheet, append_rows', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_sheets', 'read_sheet', 'append_rows']),
    );
  });

  it('read_sheet calls Sheets values endpoint', async () => {
    process.env['GOOGLE_SHEETS_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ values: [] }));
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'read_sheet',
          arguments: { spreadsheetId: 'sid', range: 'Sheet1!A1:D10' },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain('https://sheets.googleapis.com/v4/spreadsheets/sid/values/');
    expect(url).toContain('Sheet1');
  });

  it('append_rows POSTs values array', async () => {
    process.env['GOOGLE_SHEETS_TOKEN'] = 't';
    vi.stubGlobal('fetch', makeFetchOk({ updates: {} }));
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'append_rows',
          arguments: {
            spreadsheetId: 'sid',
            range: 'Sheet1!A1',
            values: [
              ['a', 'b'],
              ['c', 'd'],
            ],
          },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[1]?.method).toBe('POST');
    expect(String(call?.[0])).toContain(':append');
  });

  it('requires spreadsheetId and range for read_sheet', async () => {
    process.env['GOOGLE_SHEETS_TOKEN'] = 't';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read_sheet', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when token missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_sheets', arguments: { spreadsheetId: 'x' } } },
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
