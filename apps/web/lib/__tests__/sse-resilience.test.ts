import { afterEach, describe, expect, it, vi } from 'vitest';

import { readChatStream } from '../chat-stream';

function sseBodyLines(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const chunks = lines.map((l) => enc.encode(`${l}\n\n`));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((ch) => controller.enqueue(ch));
      controller.close();
    },
  });
}

describe('FE-4 — SSE resilience (chat-stream)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('survives a malformed frame: valid text before AND after a bad line is still accumulated', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      body: sseBodyLines([
        'data: {"type":"text","content":"Hel"}',
        'data: this-is-not-json', // malformed frame
        'data: {"type":"text","content":"lo"}',
        'data: {"type":"done"}',
      ]),
    }));

    const text = await readChatStream('hi');
    // Both valid text frames accumulated despite the bad line in between.
    expect(text).toBe('Hello');
  });

  it('survives a frame that is valid JSON but wrong shape', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      body: sseBodyLines([
        'data: {"type":"text","content":"A"}',
        'data: {"unexpected":true}', // valid JSON, no type/content
        'data: {"type":"text","content":"B"}',
      ]),
    }));

    expect(await readChatStream('hi')).toBe('AB');
  });

  it('does not throw when the very first line is malformed', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      body: sseBodyLines(['data: {broken', 'data: {"type":"text","content":"ok"}']),
    }));

    expect(await readChatStream('hi')).toBe('ok');
  });
});
