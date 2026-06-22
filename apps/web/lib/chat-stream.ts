/**
 * Consolidate a worker `/chat/send` SSE stream into a single assistant string.
 *
 * The voice conversation hook needs the full reply text for TTS, so it cannot
 * consume the stream incrementally like the chat view does. This helper reads
 * the SSE events once and returns the concatenated `text` content.
 *
 * (FIX-011 — replaces the previous `fetch('/api/chat')` call that pointed at a
 * non-existent route.)
 */

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

interface ChatSseEvent {
  type?: string;
  content?: string;
}

/** Drive an SSE body, invoking `onLine` for each raw line buffered from chunks. */
async function readSseLines(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    lines.forEach(onLine);
  }
}

function accumulateText(line: string, sink: { content: string }): void {
  if (!line.startsWith('data: ')) return;
  const raw = line.slice(6).trim();
  if (!raw) return;
  const ev = JSON.parse(raw) as ChatSseEvent;
  if (ev.type === 'text' && ev.content) sink.content += ev.content;
}

export async function readChatStream(message: string, agentId?: string): Promise<string> {
  const res = await fetch(`${WORKER_URL}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message,
      ...(agentId !== undefined ? { agentId } : {}),
    }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const sink = { content: '' };
  await readSseLines(res.body, (line) => accumulateText(line, sink));
  return sink.content;
}
