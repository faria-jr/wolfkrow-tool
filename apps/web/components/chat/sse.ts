import type { ArtifactData, ArtifactKind } from '@wolfkrow/domain';

import type { ToolCall } from './tool-call-inline';

export type SSEEvent =
  | { type: 'ack'; message?: string }
  | { type: 'text'; content: string }
  | { type: 'done'; usage?: unknown }
  | { type: 'error'; message: string }
  | { type: 'ask_question'; prompt: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; callId: string; output: string; isError: boolean }
  | { type: 'tool_permission'; id: string; name: string; input: Record<string, unknown>; prompt: string }
  | { type: 'artifact'; artifact: ArtifactPayload };

export interface ArtifactPayload {
  id: string;
  type: ArtifactKind;
  toolName: string;
  title?: string;
  data: ArtifactData;
}

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
  onArtifact?: (artifact: ArtifactPayload) => void;
}

function parseSseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  return raw ? (JSON.parse(raw) as SSEEvent) : null;
}

const EVENT_DISPATCHERS: Record<SSEEvent['type'], ((ev: SSEEvent, cb: SseCallbacks) => void) | undefined> = {
  ack: () => undefined,
  text: (ev, cb) => cb.onText((ev as Extract<SSEEvent, { type: 'text' }>).content),
  ask_question: (ev, cb) => cb.onAskQuestion?.((ev as Extract<SSEEvent, { type: 'ask_question' }>).prompt),
  tool_call: (ev, cb) => cb.onToolCall?.({ id: (ev as Extract<SSEEvent, { type: 'tool_call' }>).id, name: (ev as Extract<SSEEvent, { type: 'tool_call' }>).name, input: (ev as Extract<SSEEvent, { type: 'tool_call' }>).input, status: 'running' }),
  tool_result: (ev, cb) => cb.onToolResult?.((ev as Extract<SSEEvent, { type: 'tool_result' }>).callId, (ev as Extract<SSEEvent, { type: 'tool_result' }>).output, (ev as Extract<SSEEvent, { type: 'tool_result' }>).isError),
  tool_permission: (ev, cb) => cb.onToolPermission?.({ callId: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).id, name: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).name, prompt: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).prompt }),
  artifact: (ev, cb) => cb.onArtifact?.((ev as Extract<SSEEvent, { type: 'artifact' }>).artifact),
  done: () => undefined,
  error: () => undefined,
};

function dispatchSseEvent(ev: SSEEvent, cb: SseCallbacks): void {
  EVENT_DISPATCHERS[ev.type]?.(ev, cb);
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
