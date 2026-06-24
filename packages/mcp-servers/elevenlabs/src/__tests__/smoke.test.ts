import { handleRpcMessage } from '@wolfkrow/mcp-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { handlers } from '../index';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['ELEVENLABS_API_KEY'];
  delete process.env['ELEVENLABS_VOICE_ID'];
});

describe('elevenlabs MCP server smoke tests', () => {
  it('initialize handshake returns protocol version and tools capability', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }, handlers);
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      capabilities: { tools: {} },
    });
  });

  it('tools/list returns list_voices and text_to_speech', async () => {
    const res = await handleRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, handlers);
    const tools = (res?.result as { tools: { name: string }[] })?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_voices', 'text_to_speech']));
  });

  it('list_voices calls ElevenLabs /voices', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'k';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ voices: [{ voice_id: 'vid', name: 'Rachel' }] }),
      }),
    );
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_voices', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/v1/voices');
  });

  it('text_to_speech encodes audio as base64', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'k';
    const audioBytes = Buffer.from('fake-mpeg-bytes');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (h: string) => (h === 'content-type' ? 'audio/mpeg' : null) },
        arrayBuffer: async () => audioBytes.buffer.slice(
          audioBytes.byteOffset,
          audioBytes.byteOffset + audioBytes.byteLength,
        ),
      }),
    );
    const res = await handleRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'text_to_speech',
          arguments: { text: 'hello world', voice_id: 'vid' },
        },
      },
      handlers,
    );
    expect(res?.result).toMatchObject({ content: expect.any(Array) });
    const text = (res?.result as { content: { text: string }[] }).content[0]?.text ?? '{}';
    const parsed = JSON.parse(text) as { audioBase64: string; sizeBytes: number };
    expect(parsed.audioBase64).toBe(audioBytes.toString('base64'));
    expect(parsed.sizeBytes).toBe(audioBytes.length);
  });

  it('text_to_speech requires text', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'k';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'text_to_speech', arguments: { voice_id: 'vid' } } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('text_to_speech requires voice_id when env not set', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'k';
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'text_to_speech', arguments: { text: 'hi' } } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });

  it('returns isError when api key missing', async () => {
    const res = await handleRpcMessage(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_voices', arguments: {} } },
      handlers,
    );
    expect(res?.result).toMatchObject({ isError: true });
  });
});
