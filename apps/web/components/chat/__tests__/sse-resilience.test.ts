/**
 * FE-4 — Resilience test for the incremental chat SSE parser (sse.ts).
 *
 * A single malformed `data:` frame must NOT abort the stream. Valid text frames
 * before AND after the bad line must still dispatch to the callbacks.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamSse } from '../sse';

function sseResponse(lines: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      lines.forEach((l) => controller.enqueue(enc.encode(`${l}\n\n`)));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('FE-4 — SSE resilience (sse.ts streamSse)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('survives a malformed frame: text before and after is still received', async () => {
    vi.stubGlobal('fetch', async () =>
      sseResponse([
        'data: {"type":"text","content":"Hel"}',
        'data: this-is-not-valid-json', // malformed
        'data: {"type":"text","content":"lo"}',
        'data: {"type":"done"}',
      ])
    );

    const received: string[] = [];
    await streamSse('http://localhost/chat/send', { message: 'hi' }, new AbortController().signal, {
      onText: (t) => received.push(t),
    });

    expect(received).toEqual(['Hel', 'lo']);
  });

  it('does not throw when the first frame is malformed', async () => {
    vi.stubGlobal('fetch', async () =>
      sseResponse(['data: {broken', 'data: {"type":"text","content":"ok"}'])
    );

    const received: string[] = [];
    await expect(
      streamSse('http://localhost/chat/send', { message: 'hi' }, new AbortController().signal, {
        onText: (t) => received.push(t),
      })
    ).resolves.toBeUndefined();
    expect(received).toEqual(['ok']);
  });

  it('survives a frame with valid JSON but wrong event shape', async () => {
    vi.stubGlobal('fetch', async () =>
      sseResponse([
        'data: {"type":"text","content":"A"}',
        'data: {"unknownField":42}', // valid JSON, unknown type
        'data: {"type":"text","content":"B"}',
      ])
    );

    const received: string[] = [];
    await streamSse('http://localhost/chat/send', { message: 'hi' }, new AbortController().signal, {
      onText: (t) => received.push(t),
    });
    expect(received).toEqual(['A', 'B']);
  });
});
