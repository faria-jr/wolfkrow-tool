/**
 * Consolidate a web `/api/chat/send` SSE stream into a single assistant string.
 *
 * The voice conversation hook needs the full reply text for TTS, so it cannot
 * consume the stream incrementally like the chat view does. This helper reads
 * the SSE events once and returns the concatenated `text` content.
 *
 * Routes through the web proxy (`/api/chat/send`) — NOT the worker directly —
 * so the session cookie is forwarded as `Authorization: Bearer` (FIX-011 /
 * F1.1). The previous `${WORKER_URL}/chat/send` call hit the worker cross-origin
 * without a usable credential → 401.
 */

interface ChatSseEvent {
  type?: string;
  content?: string;
}

/** Drive an SSE body, invoking `onLine` for each raw line buffered from chunks. */
async function readSseLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    // FE-4: isolate each line so one bad frame can't abort the whole read loop.
    for (const line of lines) {
      try {
        onLine(line);
      } catch {
        // malformed frame — skip, keep draining the stream
      }
    }
  }
}

function accumulateText(line: string, sink: { content: string }): void {
  if (!line.startsWith('data: ')) return;
  const raw = line.slice(6).trim();
  if (!raw) return;
  // FE-4: resilient parse — a malformed frame must NOT break the consolidating stream.
  let ev: ChatSseEvent;
  try {
    ev = JSON.parse(raw) as ChatSseEvent;
  } catch {
    return;
  }
  if (ev.type === 'text' && ev.content) sink.content += ev.content;
}

export async function readChatStream(message: string, agentId?: string): Promise<string> {
  const res = await fetch('/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
