import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['NANO_BANANA_API_KEY'];
  delete process.env['NANO_BANANA_BASE_URL'];
});

describe('nano-banana MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns generate_image', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain('generate_image');
  });

  it('generate_image encodes response as base64', async () => {
    process.env['NANO_BANANA_API_KEY'] = 'k';
    const img = Buffer.from('fake-png-bytes');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () =>
          img.buffer.slice(img.byteOffset, img.byteOffset + img.byteLength),
      }),
    );
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'generate_image',
          arguments: { prompt: 'a banana in space', width: 512, height: 512 },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const text = (res?.result as { content: { text: string }[] }).content[0]?.text ?? '{}';
    const parsed = JSON.parse(text) as { imageBase64: string; sizeBytes: number };
    expect(parsed.imageBase64).toBe(img.toString('base64'));
    expect(parsed.sizeBytes).toBe(img.length);
    const callBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as {
      prompt: string;
      width: number;
    };
    expect(callBody.prompt).toBe('a banana in space');
    expect(callBody.width).toBe(512);
  });

  it('uses NANO_BANANA_BASE_URL override', async () => {
    process.env['NANO_BANANA_API_KEY'] = 'k';
    process.env['NANO_BANANA_BASE_URL'] = 'https://custom.example.com';
    const img = Buffer.from('x');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => img.buffer.slice(img.byteOffset, img.byteOffset + img.byteLength),
      }),
    );
    await handleRpcMessage(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'generate_image', arguments: { prompt: 'x' } } },
      handlers,
    );
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('https://custom.example.com');
  });

  it('generate_image requires prompt', async () => {
    process.env['NANO_BANANA_API_KEY'] = 'k';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'generate_image', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when api key missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'generate_image', arguments: { prompt: 'x' } } },
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
