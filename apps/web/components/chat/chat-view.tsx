'use client';

import { useCallback, useRef, useState } from 'react';

import type { DisplayMessage } from './chat-message';
import { ChatMessage } from './chat-message';
import { StreamIndicator } from './stream-indicator';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:3001';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

interface SSEEvent {
  type: 'ack' | 'text' | 'done' | 'error';
  content?: string;
}

function parseSseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  return raw ? (JSON.parse(raw) as SSEEvent) : null;
}

async function streamSse(url: string, body: unknown, signal: AbortSignal, onText: (t: string) => void): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const ev = parseSseLine(line);
      if (ev?.type === 'text' && ev.content) onText(ev.content);
    }
  }
}

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} placeholder="Message (Enter to send, Shift+Enter for newline)" className="min-h-[44px] max-h-32 resize-none" disabled={disabled} aria-label="Chat input" />
        <Button onClick={onSend} disabled={disabled || !value.trim()} aria-label="Send">Send</Button>
      </div>
    </div>
  );
}

interface Props { model?: string; sessionId?: string; }

export function ChatView({ model = DEFAULT_MODEL, sessionId }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const appendToLast = useCallback((delta: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    const userMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date() };
    const assistantMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSse(`${WORKER_URL}/chat/send`, { message: text, model, sessionId }, ac.signal, appendToLast);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') appendToLast('[Error: could not connect to AI]');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [input, isStreaming, model, sessionId, appendToLast]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mt-8">Start a conversation</p>}
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
        {isStreaming && <StreamIndicator />}
        <div ref={bottomRef} />
      </div>
      <ChatInput value={input} onChange={setInput} onSend={() => void send()} disabled={isStreaming} />
    </div>
  );
}
