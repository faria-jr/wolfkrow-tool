import type { ToolCall } from './tool-call-inline';

export type SSEEvent =
  | { type: 'ack'; message?: string }
  | { type: 'text'; content: string }
  | { type: 'done'; usage?: unknown }
  | { type: 'error'; message: string }
  | { type: 'ask_question'; prompt: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; callId: string; output: string; isError: boolean }
  | { type: 'tool_permission'; id: string; name: string; input: Record<string, unknown>; prompt: string };

export interface PendingPermission {
  callId: string;
  name: string;
  prompt: string;
}

export interface SseCallbacks {
  onText: (t: string) => void;
  onAskQuestion?: (q: string) => void;
  onToolCall?: (tc: ToolCall) => void;
  onToolResult?: (callId: string, output: string, isError: boolean) => void;
  onToolPermission?: (p: PendingPermission) => void;
}

function parseSseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  return raw ? (JSON.parse(raw) as SSEEvent) : null;
}

function dispatchSseEvent(ev: SSEEvent, cb: SseCallbacks): void {
  switch (ev.type) {
    case 'text':
      cb.onText(ev.content);
      return;
    case 'ask_question':
      cb.onAskQuestion?.(ev.prompt);
      return;
    case 'tool_call':
      cb.onToolCall?.({ id: ev.id, name: ev.name, input: ev.input, status: 'running' });
      return;
    case 'tool_result':
      cb.onToolResult?.(ev.callId, ev.output, ev.isError);
      return;
    case 'tool_permission':
      cb.onToolPermission?.({ callId: ev.id, name: ev.name, prompt: ev.prompt });
  }
}

function processLine(line: string, cb: SseCallbacks): void {
  const ev = parseSseLine(line);
  if (ev) dispatchSseEvent(ev, cb);
}

async function readSseStream(stream: ReadableStream<Uint8Array>, cb: SseCallbacks): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) processLine(line, cb);
  }
}

export async function streamSse(url: string, body: unknown, signal: AbortSignal, cb: SseCallbacks): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await readSseStream(res.body, cb);
}
