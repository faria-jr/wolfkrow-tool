/**
 * Cartesia + ElevenLabs TTS providers — happy + error + stream paths.
 *
 * Mocks global fetch so no real HTTP is made. Covers synthesize ok/non-ok,
 * streamSynthesize, default + custom voice/model, and the speed option.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import { CartesiaTtsProvider } from '../cartesia';
import { ElevenLabsTtsProvider } from '../elevenlabs';

const originalFetch = globalThis.fetch;

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('CartesiaTtsProvider', () => {
  it('synthesizes audio via the /tts/bytes endpoint with the default voice', async () => {
    let capturedBody: { model_id: string; voice: { id: string }; transcript: string } | undefined;
    mockFetch(async (_url, init) => {
      capturedBody = JSON.parse(String(init!.body)) as typeof capturedBody;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });

    const provider = new CartesiaTtsProvider('sk-c');
    const buf = await provider.synthesize('hello');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(3);
    expect(capturedBody!.voice.id).toMatch(/^[0-9a-f-]{36}$/); // default voice id
    expect(capturedBody!.transcript).toBe('hello');
  });

  it('uses a custom voice + model when provided', async () => {
    let captured: { model_id: string; voice: { id: string } } | undefined;
    mockFetch(async (_url, init) => {
      captured = JSON.parse(String(init!.body)) as typeof captured;
      return new Response(new Uint8Array([0]), { status: 200 });
    });
    await new CartesiaTtsProvider('sk').synthesize('hi', { voice: 'custom-voice', model: 'other-model' });
    expect(captured!.voice.id).toBe('custom-voice');
    expect(captured!.model_id).toBe('other-model');
  });

  it('throws on a non-ok response', async () => {
    mockFetch(async () => new Response('err', { status: 500 }));
    await expect(new CartesiaTtsProvider('sk').synthesize('x')).rejects.toThrow(/Cartesia error 500/);
  });

  it('streamSynthesize yields the full audio buffer', async () => {
    mockFetch(async () => new Response(new Uint8Array([10, 20, 30]), { status: 200 }));
    const provider = new CartesiaTtsProvider('sk');
    const chunks: Buffer[] = [];
    for await (const c of provider.streamSynthesize('stream me')) chunks.push(c);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.length).toBe(3);
  });
});

describe('ElevenLabsTtsProvider', () => {
  it('synthesizes with the default voice id when none given', async () => {
    let captured: { model_id: string; voice_settings: { speed: number } } | undefined;
    let capturedUrl = '';
    mockFetch(async (url, init) => {
      capturedUrl = String(url);
      captured = JSON.parse(String(init!.body)) as typeof captured;
      return new Response(new Uint8Array([5]), { status: 200 });
    });
    const buf = await new ElevenLabsTtsProvider('sk').synthesize('hi');
    expect(buf.length).toBe(1);
    expect(capturedUrl).toContain('/text-to-speech/21m00Tcm4TlvDq8ikWAM');
    expect(captured!.voice_settings.speed).toBe(1.0);
  });

  it('honors a custom constructor voice + speed option', async () => {
    let capturedUrl = '';
    let captured: { voice_settings: { speed: number } } | undefined;
    mockFetch(async (url, init) => {
      capturedUrl = String(url);
      captured = JSON.parse(String(init!.body)) as typeof captured;
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await new ElevenLabsTtsProvider('sk', 'custom-voice').synthesize('hi', { speed: 1.5 });
    expect(capturedUrl).toContain('/text-to-speech/custom-voice');
    expect(captured!.voice_settings.speed).toBe(1.5);
  });

  it('throws on a non-ok synthesize response', async () => {
    mockFetch(async () => new Response('e', { status: 401 }));
    await expect(new ElevenLabsTtsProvider('sk').synthesize('x')).rejects.toThrow(/ElevenLabs error 401/);
  });

  it('streamSynthesize yields chunks from the response body', async () => {
    // Build a ReadableStream that emits two chunks then closes.
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    mockFetch(async () => new Response(body, { status: 200 }));
    const provider = new ElevenLabsTtsProvider('sk');
    const chunks: Buffer[] = [];
    for await (const c of provider.streamSynthesize('stream')) chunks.push(c);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.length).toBe(2);
  });

  it('streamSynthesize throws on a non-ok response', async () => {
    mockFetch(async () => new Response('e', { status: 502 }));
    const provider = new ElevenLabsTtsProvider('sk');
    await expect(async () => {
      for await (const _c of provider.streamSynthesize('x')) void _c;
    }).rejects.toThrow(/ElevenLabs stream error 502/);
  });
});
