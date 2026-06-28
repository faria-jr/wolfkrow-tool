'use client';

import { useCallback, useRef, useState } from 'react';

import type { AttachmentData } from './attachment-dropzone';
import type { DisplayMessage } from './chat-message';
import { useTokenUsage } from './chat-token-usage';
import type { ArtifactPayload, PendingHumanQuestion, PendingPermission, SseCallbacks } from './sse';
import { streamSse } from './sse';
import type { ToolCall } from './tool-call-inline';


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

function applyToolResult(
  prev: DisplayMessage[],
  callId: string,
  output: string,
  isError: boolean
): DisplayMessage[] {
  return prev.map((msg) => {
    if (!msg.toolCalls) return msg;
    return {
      ...msg,
      toolCalls: msg.toolCalls.map((tc) =>
        tc.id === callId
          ? { ...tc, output, status: isError ? ('error' as const) : ('done' as const) }
          : tc
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
  const appendText = useCallback(
    (delta: string) => setMessages((prev) => appendDeltaToLast(prev, delta)),
    []
  );
  const appendMessage = useCallback(
    (msg: DisplayMessage) => setMessages((prev) => [...prev, msg]),
    []
  );
  const appendToolCall = useCallback(
    (tc: ToolCall) => setMessages((prev) => applyToolCall(prev, tc)),
    []
  );
  const updateToolCall = useCallback(
    (callId: string, output: string, isError: boolean) =>
      setMessages((prev) => applyToolResult(prev, callId, output, isError)),
    []
  );
  const appendArtifact = useCallback(
    (artifact: ArtifactPayload) => setMessages((prev) => appendArtifactToLast(prev, artifact)),
    []
  );
  return {
    messages,
    setMessages,
    appendText,
    appendMessage,
    appendToolCall,
    updateToolCall,
    appendArtifact,
  };
}

export function useToolPermission() {
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const onPermission = useCallback((p: PendingPermission) => setPendingPermission(p), []);
  const resolvePermission = useCallback(async (callId: string, approved: boolean) => {
    setPendingPermission(null);
    await fetch('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ callId, approved }),
    });
  }, []);
  return { pendingPermission, onPermission, resolvePermission };
}

export function useHumanQuestion() {
  const [pendingQuestion, setPendingQuestion] = useState<PendingHumanQuestion | null>(null);
  const onHumanQuestion = useCallback((q: PendingHumanQuestion) => setPendingQuestion(q), []);
  /** Answer resolves the parked worker promise AND returns the text so the
   *  caller can append it as the next user message (the answer flows into the
   *  conversation naturally). */
  const resolveQuestion = useCallback(async (questionId: string, answer: string) => {
    setPendingQuestion(null);
    await fetch('/api/chat/human-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ questionId, answer }),
    });
    return answer;
  }, []);
  const dismissQuestion = useCallback(() => setPendingQuestion(null), []);
  return { pendingQuestion, onHumanQuestion, resolveQuestion, dismissQuestion };
}

interface ChatStreamOptions {
  model: string;
  sessionId: string | undefined;
  state: ReturnType<typeof useMessageState>;
  onPermission: (p: PendingPermission) => void;
  onHumanQuestion: (q: PendingHumanQuestion) => void;
  onDone: (usage: { inputTokens?: number; outputTokens?: number }) => void;
}

function buildSseCallbacks(
  state: ReturnType<typeof useMessageState>,
  onPermission: (p: PendingPermission) => void,
  onHumanQuestion: (q: PendingHumanQuestion) => void,
  onDone: (usage: { inputTokens?: number; outputTokens?: number }) => void
): SseCallbacks {
  return {
    onText: state.appendText,
    onToolCall: state.appendToolCall,
    onToolResult: state.updateToolCall,
    onToolPermission: onPermission,
    onHumanQuestion,
    onArtifact: state.appendArtifact,
    onDone,
  };
}

export function useChatStream({ model, sessionId, state, onPermission, onHumanQuestion, onDone }: ChatStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const doSend = useCallback(
    async (text: string, attachments: AttachmentData[], onTitle: () => void) => {
      if (!text || isStreaming) return;
      onTitle();
      const userMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        createdAt: new Date(),
      };
      const asstMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      };
      state.setMessages((prev) => [...prev, userMsg, asstMsg]);
      setIsStreaming(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const callbacks = buildSseCallbacks(state, onPermission, onHumanQuestion, onDone);
      try {
        const body: Record<string, unknown> = { message: text, model, sessionId };
        if (attachments.length) body['attachments'] = attachments;
        await streamSse('/api/chat/send', body, ac.signal, callbacks);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError')
          state.appendText('[Error: could not connect to AI]');
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      }
    },
    [isStreaming, model, sessionId, state, onPermission, onHumanQuestion, onDone]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, doSend, stop, bottomRef };
}

interface ChatActionsOptions {
  input: string;
  state: ReturnType<typeof useMessageState>;
  stream: ReturnType<typeof useChatStream>;
  humanQuestion: ReturnType<typeof useHumanQuestion>;
  setSessionTitle: (t: string) => void;
  pendingAttachments: AttachmentData[];
  setInput: (v: string) => void;
  setPendingAttachments: (v: AttachmentData[]) => void;
}

function useChatActions(opts: ChatActionsOptions) {
  const hasSetTitle = useRef(false);
  const markTitle = useCallback(() => {
    if (!hasSetTitle.current) {
      opts.setSessionTitle(deriveTitle(opts.input));
      hasSetTitle.current = true;
    }
  }, [opts.input, opts.setSessionTitle]);

  const send = useCallback(() => {
    const text = opts.input.trim();
    if (!text || opts.stream.isStreaming) return;
    const atts = opts.pendingAttachments;
    opts.setInput('');
    opts.setPendingAttachments([]);
    void opts.stream.doSend(text, atts, markTitle);
  }, [opts, markTitle]);

  const clear = useCallback(() => {
    opts.state.setMessages([]);
    opts.setSessionTitle('New Chat');
    hasSetTitle.current = false;
  }, [opts]);

  /** Resolves a HITL ask-user question on the worker AND sends the answer as
   *  the next user message so it flows back into the conversation. */
  const answerQuestion = useCallback(
    async (questionId: string, answer: string) => {
      await opts.humanQuestion.resolveQuestion(questionId, answer);
      if (answer.trim() && !opts.stream.isStreaming) {
        void opts.stream.doSend(answer.trim(), [], markTitle);
      }
    },
    [opts.humanQuestion, opts.stream, markTitle]
  );

  return { send, clear, answerQuestion };
}

export function useChatSession(model: string, sessionId?: string) {
  const state = useMessageState();
  const permission = useToolPermission();
  const humanQuestion = useHumanQuestion();
  const tokens = useTokenUsage();
  const [input, setInput] = useState('');
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentData[]>([]);
  const stream = useChatStream({
    model, sessionId, state,
    onPermission: permission.onPermission,
    onHumanQuestion: humanQuestion.onHumanQuestion,
    onDone: tokens.onDone,
  });
  const { send, clear, answerQuestion } = useChatActions({
    input, state, stream, humanQuestion, setSessionTitle,
    pendingAttachments, setInput, setPendingAttachments,
  });
  const clearAll = useCallback(() => { clear(); tokens.reset(); }, [clear, tokens]);

  return {
    messages: state.messages, input, setInput, isStreaming: stream.isStreaming,
    sessionTitle, send, stop: stream.stop, clear: clearAll,
    appendMessage: state.appendMessage, bottomRef: stream.bottomRef,
    pendingAttachments, setPendingAttachments,
    pendingPermission: permission.pendingPermission, resolvePermission: permission.resolvePermission,
    pendingQuestion: humanQuestion.pendingQuestion, answerQuestion,
    dismissQuestion: humanQuestion.dismissQuestion,
    lastUsage: tokens.lastUsage, totalTokens: tokens.totalTokens,
  };
}
