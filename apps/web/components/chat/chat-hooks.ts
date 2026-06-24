'use client';

import { useCallback, useRef, useState } from 'react';

import type { AttachmentData } from './attachment-dropzone';
import type { DisplayMessage } from './chat-message';
import type { ArtifactPayload, PendingPermission, SseCallbacks } from './sse';
import { streamSse } from './sse';
import type { ToolCall } from './tool-call-inline';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

export function deriveTitle(text: string): string {
  const t = text.trim();
  if (t.length <= 40) return t;
  const cut = t.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 10 ? cut.slice(0, lastSpace) : cut;
}

function appendDeltaToLast(prev: DisplayMessage[], delta: string): DisplayMessage[] {
  const last = prev[prev.length - 1];
  if (!last || last.role !== 'assistant') return prev;
  return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
}

function applyToolCall(prev: DisplayMessage[], tc: ToolCall): DisplayMessage[] {
  const last = prev[prev.length - 1];
  if (!last || last.role !== 'assistant') return prev;
  return [...prev.slice(0, -1), { ...last, toolCalls: [...(last.toolCalls ?? []), tc] }];
}

function applyToolResult(prev: DisplayMessage[], callId: string, output: string, isError: boolean): DisplayMessage[] {
  return prev.map((msg) => {
    if (!msg.toolCalls) return msg;
    return {
      ...msg,
      toolCalls: msg.toolCalls.map((tc) =>
        tc.id === callId ? { ...tc, output, status: isError ? ('error' as const) : ('done' as const) } : tc,
      ),
    };
  });
}

function appendArtifactToLast(prev: DisplayMessage[], artifact: ArtifactPayload): DisplayMessage[] {
  const last = prev[prev.length - 1];
  if (!last || last.role !== 'assistant') return prev;
  return [...prev.slice(0, -1), { ...last, artifacts: [...(last.artifacts ?? []), artifact] }];
}

export function useMessageState() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const appendText = useCallback((delta: string) => setMessages((prev) => appendDeltaToLast(prev, delta)), []);
  const appendMessage = useCallback((msg: DisplayMessage) => setMessages((prev) => [...prev, msg]), []);
  const appendToolCall = useCallback((tc: ToolCall) => setMessages((prev) => applyToolCall(prev, tc)), []);
  const updateToolCall = useCallback(
    (callId: string, output: string, isError: boolean) =>
      setMessages((prev) => applyToolResult(prev, callId, output, isError)),
    [],
  );
  const appendArtifact = useCallback(
    (artifact: ArtifactPayload) => setMessages((prev) => appendArtifactToLast(prev, artifact)),
    [],
  );
  return { messages, setMessages, appendText, appendMessage, appendToolCall, updateToolCall, appendArtifact };
}

export function useToolPermission() {
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const onPermission = useCallback((p: PendingPermission) => setPendingPermission(p), []);
  const resolvePermission = useCallback(async (callId: string, approved: boolean) => {
    setPendingPermission(null);
    await fetch(`${WORKER_URL}/chat/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ callId, approved }),
    });
  }, []);
  return { pendingPermission, onPermission, resolvePermission };
}

interface ChatStreamOptions {
  model: string;
  sessionId: string | undefined;
  state: ReturnType<typeof useMessageState>;
  onPermission: (p: PendingPermission) => void;
}

export function useChatStream({ model, sessionId, state, onPermission }: ChatStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const doSend = useCallback(
    async (text: string, attachments: AttachmentData[], onTitle: () => void) => {
      if (!text || isStreaming) return;
      onTitle();
      const userMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date() };
      const asstMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: new Date() };
      state.setMessages((prev) => [...prev, userMsg, asstMsg]);
      setIsStreaming(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const callbacks: SseCallbacks = {
        onText: state.appendText,
        onToolCall: state.appendToolCall,
        onToolResult: state.updateToolCall,
        onToolPermission: onPermission,
        onArtifact: state.appendArtifact,
      };
      try {
        const body: Record<string, unknown> = { message: text, model, sessionId };
        if (attachments.length) body['attachments'] = attachments;
        await streamSse(`${WORKER_URL}/chat/send`, body, ac.signal, callbacks);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') state.appendText('[Error: could not connect to AI]');
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      }
    },
    [isStreaming, model, sessionId, state, onPermission],
  );

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  return { isStreaming, doSend, stop, bottomRef };
}

export function useChatSession(model: string, sessionId?: string) {
  const state = useMessageState();
  const permission = useToolPermission();
  const [input, setInput] = useState('');
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentData[]>([]);
  const hasSetTitle = useRef(false);
  const stream = useChatStream({ model, sessionId, state, onPermission: permission.onPermission });

  const markTitle = useCallback(() => {
    if (!hasSetTitle.current) {
      setSessionTitle(deriveTitle(input));
      hasSetTitle.current = true;
    }
  }, [input]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || stream.isStreaming) return;
    const atts = pendingAttachments;
    setInput('');
    setPendingAttachments([]);
    void stream.doSend(text, atts, markTitle);
  }, [stream, input, pendingAttachments, markTitle]);

  const clear = useCallback(() => { state.setMessages([]); setSessionTitle('New Chat'); hasSetTitle.current = false; }, [state]);

  return {
    messages: state.messages,
    input, setInput,
    isStreaming: stream.isStreaming,
    sessionTitle,
    send, stop: stream.stop, clear,
    appendMessage: state.appendMessage,
    bottomRef: stream.bottomRef,
    pendingAttachments, setPendingAttachments,
    pendingPermission: permission.pendingPermission,
    resolvePermission: permission.resolvePermission,
  };
}
