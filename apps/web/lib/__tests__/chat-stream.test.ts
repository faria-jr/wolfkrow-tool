import { afterEach, describe, expect, it, vi } from 'vitest';

import { readChatStream } from '../chat-stream';

function sseBody(events: Array<{ type: string; content?: string }>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const chunks = events.map((e) => enc.encode(`data: ${JSON.stringify(e)}\n\n`));
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((ch) => controller.enqueue(ch));
      controller.close();
    },
  });
}

describe('readChatStream (FIX-011)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consolidates SSE text events into a single string', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      body: sseBody([
        { type: 'ack' },
        { type: 'text', content: 'Hel' },
        { type: 'text', content: 'lo' },
        { type: 'done' },
      ]),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const text = await readChatStream('hi');

    expect(text).toBe('Hello');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/send'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('returns empty string when the stream has no text events', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, body: sseBody([{ type: 'done' }]) }));
    expect(await readChatStream('hi')).toBe('');
  });

  it('throws on a non-ok response, surfacing the status', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500, body: null }));
    await expect(readChatStream('hi')).rejects.toThrow(/500/);
  });

  it('passes agentId through when provided', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      body: sseBody([{ type: 'text', content: 'x' }]),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await readChatStream('hi', 'agent-7');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ message: 'hi', agentId: 'agent-7' });
  });
});
