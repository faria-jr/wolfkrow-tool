'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AskQuestionDialog } from './ask-question-dialog';
import type { DisplayMessage } from './chat-message';
import { ChatMessage } from './chat-message';
import { ConfirmDialog } from './confirm-dialog';
import { StreamIndicator } from './stream-indicator';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceOrb } from '@/components/voice/voice-orb';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';
import type { UseVoiceConversationReturn, VoiceConversationMessage } from '@/hooks/use-voice-conversation';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

interface SSEEvent {
  type: 'ack' | 'text' | 'done' | 'error' | 'ask_question';
  content?: string;
  prompt?: string;
}

interface SseCallbacks { onText: (t: string) => void; onAskQuestion?: (q: string) => void; }

function parseSseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  return raw ? (JSON.parse(raw) as SSEEvent) : null;
}

function processLine(line: string, cb: SseCallbacks): void {
  const ev = parseSseLine(line);
  if (ev?.type === 'text' && ev.content) cb.onText(ev.content);
  if (ev?.type === 'ask_question' && ev.prompt) cb.onAskQuestion?.(ev.prompt);
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

async function streamSse(url: string, body: unknown, signal: AbortSignal, cb: SseCallbacks): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await readSseStream(res.body, cb);
}

function deriveTitle(text: string): string {
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

function voiceMessageToDisplay(msg: VoiceConversationMessage): DisplayMessage {
  return { id: crypto.randomUUID(), role: msg.role, content: msg.text, createdAt: new Date() };
}

function useChatSession(model: string, sessionId?: string) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSetTitle = useRef(false);
  const appendText = useCallback((delta: string) => setMessages((prev) => appendDeltaToLast(prev, delta)), []);
  const appendMessage = useCallback((msg: DisplayMessage) => setMessages((prev) => [...prev, msg]), []);
  const onAsk = useCallback((q: string) => setPendingQuestion(q), []);
  const doSend = useCallback(async (text: string) => {
    if (!text || isStreaming) return;
    if (!hasSetTitle.current) { setSessionTitle(deriveTitle(text)); hasSetTitle.current = true; }
    const userMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date() };
    const asstMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(`${WORKER_URL}/chat/send`, { message: text, model, sessionId }, ac.signal, { onText: appendText, onAskQuestion: onAsk });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') appendText('[Error: could not connect to AI]');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [isStreaming, model, sessionId, appendText, onAsk]);
  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    void doSend(text);
  }, [doSend, input, isStreaming]);
  const answerQuestion = useCallback((a: string) => { setPendingQuestion(null); void doSend(a); }, [doSend]);
  const dismissQuestion = useCallback(() => setPendingQuestion(null), []);
  const clear = useCallback(() => { setMessages([]); setSessionTitle('New Chat'); hasSetTitle.current = false; }, []);
  return { messages, input, setInput, isStreaming, sessionTitle, pendingQuestion, dismissQuestion, send, clear, answerQuestion, appendMessage, bottomRef };
}

interface ChatHeaderProps { title: string; onClear: () => void; }
function ChatHeader({ title, onClear }: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">Multi-SDK AI conversation</p>
      </div>
      <button onClick={onClear} className="text-muted-foreground hover:text-destructive text-xs transition-colors">Clear</button>
    </header>
  );
}

interface ChatInputProps { value: string; onChange: (v: string) => void; onSend: () => void; disabled: boolean; }
function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="flex gap-2">
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} placeholder="Message (Enter to send, Shift+Enter for newline)" className="min-h-[44px] max-h-32 resize-none" disabled={disabled} aria-label="Chat input" />
      <Button onClick={onSend} disabled={disabled || !value.trim()} aria-label="Send">Send</Button>
    </div>
  );
}

interface ChatTranscriptProps { messages: DisplayMessage[]; isStreaming: boolean; bottomRef: React.RefObject<HTMLDivElement | null>; }
function ChatTranscript({ messages, isStreaming, bottomRef }: ChatTranscriptProps) {
  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages, bottomRef]);
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mt-8">Start a conversation</p>}
      {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
      {isStreaming && <StreamIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

interface ChatFooterProps { input: string; onInputChange: (v: string) => void; onSend: () => void; disabled: boolean; voice: UseVoiceConversationReturn; }
function ChatFooter({ input, onInputChange, onSend, disabled, voice }: ChatFooterProps) {
  const toggleVoice = () => { if (voice.state === 'idle') void voice.start(); else voice.stop(); };
  return (
    <div className="border-t p-4">
      {voice.error && <p role="alert" className="mb-2 text-sm text-destructive">{voice.error}</p>}
      <div className="flex items-end gap-3">
        <VoiceOrb state={voice.state} onClick={toggleVoice} />
        <div className="flex-1">
          <ChatInput value={input} onChange={onInputChange} onSend={onSend} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

interface Props { model?: string; sessionId?: string; }

export function ChatView({ model = DEFAULT_MODEL, sessionId }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { messages, input, setInput, isStreaming, sessionTitle, pendingQuestion, dismissQuestion, send, clear, answerQuestion, appendMessage, bottomRef } = useChatSession(model, sessionId);
  const voice = useVoiceConversation({ onMessage: (msg) => appendMessage(voiceMessageToDisplay(msg)) });
  const handleClearConfirm = () => { clear(); setConfirmOpen(false); };
  return (
    <div className="flex h-full flex-col">
      <ChatHeader title={sessionTitle} onClear={() => setConfirmOpen(true)} />
      <ChatTranscript messages={messages} isStreaming={isStreaming} bottomRef={bottomRef} />
      <ChatFooter input={input} onInputChange={setInput} onSend={send} disabled={isStreaming} voice={voice} />
      <ConfirmDialog open={confirmOpen} title="Clear chat?" description="All messages will be removed." onConfirm={handleClearConfirm} onCancel={() => setConfirmOpen(false)} />
      {pendingQuestion !== null && (
        <AskQuestionDialog open={true} question={pendingQuestion} onAnswer={answerQuestion} onCancel={dismissQuestion} />
      )}
    </div>
  );
}
