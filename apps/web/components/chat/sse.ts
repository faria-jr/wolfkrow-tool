import type { ArtifactData, ArtifactKind } from '@wolfkrow/domain';

import type { ToolCall } from './tool-call-inline';

export type SSEEvent =
  | { type: 'ack'; message?: string }
  | { type: 'text'; content: string }
  | { type: 'done'; usage?: unknown }
  | { type: 'error'; message: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; callId: string; output: string; isError: boolean }
  | {
      type: 'tool_permission';
      id: string;
      name: string;
      input: Record<string, unknown>;
      prompt: string;
    }
  | { type: 'human_question'; questionId: string; question: string; options?: string[] }
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

export interface PendingHumanQuestion {
  questionId: string;
  question: string;
  options?: string[];
}

export interface SseCallbacks {
  onText: (t: string) => void;
  onToolCall?: (tc: ToolCall) => void;
  onToolResult?: (callId: string, output: string, isError: boolean) => void;
  onToolPermission?: (p: PendingPermission) => void;
  onHumanQuestion?: (q: PendingHumanQuestion) => void;
  onArtifact?: (artifact: ArtifactPayload) => void;
}

function parseSseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  if (!raw) return null;
  // FE-4: resilient parse — a single malformed frame must NOT kill the stream.
  try {
    return JSON.parse(raw) as SSEEvent;
  } catch {
    return null;
  }
}

const EVENT_DISPATCHERS: Record<
  SSEEvent['type'],
  ((ev: SSEEvent, cb: SseCallbacks) => void) | undefined
> = {
  ack: () => undefined,
  text: (ev, cb) => cb.onText((ev as Extract<SSEEvent, { type: 'text' }>).content),
  tool_call: (ev, cb) =>
    cb.onToolCall?.({
      id: (ev as Extract<SSEEvent, { type: 'tool_call' }>).id,
      name: (ev as Extract<SSEEvent, { type: 'tool_call' }>).name,
      input: (ev as Extract<SSEEvent, { type: 'tool_call' }>).input,
      status: 'running',
    }),
  tool_result: (ev, cb) =>
    cb.onToolResult?.(
      (ev as Extract<SSEEvent, { type: 'tool_result' }>).callId,
      (ev as Extract<SSEEvent, { type: 'tool_result' }>).output,
      (ev as Extract<SSEEvent, { type: 'tool_result' }>).isError
    ),
  tool_permission: (ev, cb) =>
    cb.onToolPermission?.({
      callId: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).id,
      name: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).name,
      prompt: (ev as Extract<SSEEvent, { type: 'tool_permission' }>).prompt,
    }),
  human_question: (ev, cb) =>
    cb.onHumanQuestion?.({
      questionId: (ev as Extract<SSEEvent, { type: 'human_question' }>).questionId,
      question: (ev as Extract<SSEEvent, { type: 'human_question' }>).question,
      ...(ev as Extract<SSEEvent, { type: 'human_question' }>).options !== undefined
        ? { options: (ev as Extract<SSEEvent, { type: 'human_question' }>).options }
        : {},
    }),
  artifact: (ev, cb) => cb.onArtifact?.((ev as Extract<SSEEvent, { type: 'artifact' }>).artifact),
  done: () => undefined,
  error: (ev, cb) => cb.onText(`[Error: ${(ev as Extract<SSEEvent, { type: 'error' }>).message}]`),
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
    // FE-4: isolate each line so one malformed/unparseable frame can't abort
    // the entire stream — valid frames before and after still dispatch.
    for (const line of lines) {
      try {
        processLine(line, cb);
      } catch {
        // malformed frame — skip, keep draining the stream
      }
    }
  }
}

export async function streamSse(
  url: string,
  body: unknown,
  signal: AbortSignal,
  cb: SseCallbacks
): Promise<void> {
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
