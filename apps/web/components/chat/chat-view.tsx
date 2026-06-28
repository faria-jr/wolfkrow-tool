'use client';

import { DEFAULT_CHAT_MODEL } from '@wolfkrow/shared-types';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { VariableSizeList } from 'react-window';

import type { AttachmentData } from './attachment-dropzone';
import { AttachmentDropzone } from './attachment-dropzone';
import { useChatSession } from './chat-hooks';
import type { DisplayMessage } from './chat-message';
import { ConfirmDialog } from './confirm-dialog';
import { HumanQuestionDialog } from './human-question-dialog';
import { ModelPicker } from './model-picker';
import { StreamIndicator } from './stream-indicator';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { VoiceOrb } from '@/components/voice/voice-orb';
import type { VoiceConversationMessage } from '@/hooks/use-voice-conversation';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';

/**
 * Lazy-loaded ChatMessage keeps react-markdown (heavy) out of the route's
 * eager bundle. Loaded on first render of the transcript with a skeleton
 * placeholder while the chunk resolves.
 */
const ChatMessage = dynamic(() => import('./chat-message').then((m) => m.ChatMessage), {
  ssr: false,
  loading: () => <Skeleton className="h-16 w-full" />,
});

type RowData = { messages: DisplayMessage[] };

/** Minimum row height and cap for the itemSize estimator (token-based). */
const ROW_BASE = 64;
const ROW_PER_CHAR = 0.25;
const ROW_CAP = 640;

function voiceMessageToDisplay(msg: VoiceConversationMessage): DisplayMessage {
  return { id: crypto.randomUUID(), role: msg.role, content: msg.text, createdAt: new Date() };
}

interface ChatHeaderProps {
  title: string;
  model: string;
  onModelChange: (m: string) => void;
  onClear: () => void;
}
function ChatHeader({ title, model, onModelChange, onClear }: ChatHeaderProps) {
  const provider = providerOfModel(model);
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {provider && (
            <Badge variant="secondary" className="text-xs font-medium">
              {provider}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">Multi-SDK AI conversation</p>
      </div>
      <div className="flex items-center gap-3">
        <ModelPicker value={model} onChange={onModelChange} />
        <Button
          onClick={onClear}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          Clear
        </Button>
      </div>
    </header>
  );
}

/** Derive an orchestrator/provider label from the model id (F3.6 badge). */
function providerOfModel(model: string): string | null {
  const m = model.toLowerCase();
  if (m.includes('glm') || m.includes('zai')) return 'Z.ai';
  if (m.includes('claude')) return 'Anthropic';
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3')) return 'OpenAI';
  if (m.includes('kimi')) return 'Moonshot';
  if (m.includes('minimax')) return 'MiniMax';
  if (m.includes('qwen')) return 'Qwen';
  return null;
}

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled: boolean;
}
function ChatInput({ value, onChange, onSend, onStop, disabled }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <div className="flex gap-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message (Enter to send, Shift+Enter for newline)"
        className="max-h-32 min-h-11 resize-none"
        disabled={disabled}
        aria-label="Chat input"
      />
      {disabled ? (
        <Button onClick={onStop} aria-label="Stop" variant="destructive">
          Stop
        </Button>
      ) : (
        <Button onClick={onSend} disabled={!value.trim()} aria-label="Send">
          Send
        </Button>
      )}
    </div>
  );
}

interface ChatTranscriptProps {
  messages: DisplayMessage[];
  isStreaming: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

/** Measures the scroll container height; non-zero default so tests render rows. */
function useContainerHeight(containerRef: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(600);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);
  return height;
}

/** Estimates a row height from content length (base + per-char, capped). */
function estimateRowHeight(message: DisplayMessage): number {
  const chars = message.content.length;
  const extras = (message.toolCalls?.length ?? 0) + (message.artifacts?.length ?? 0);
  return Math.min(ROW_CAP, ROW_BASE + Math.ceil(chars * ROW_PER_CHAR) + extras * 32);
}

function itemSizeGetter(messages: DisplayMessage[]) {
  return (index: number) =>
    estimateRowHeight(
      messages[index] ?? { id: '', role: 'user', content: '', createdAt: new Date() }
    );
}

function MessageRow({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: RowData;
}) {
  const message = data.messages[index];
  if (!message) return null;
  return (
    <div style={style}>
      <ChatMessage message={message} />
    </div>
  );
}

function ChatTranscript({ messages, isStreaming, bottomRef }: ChatTranscriptProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<VariableSizeList | null>(null);
  const height = useContainerHeight(containerRef);
  const lastIndex = messages.length - 1;
  const lastContentLen = messages[lastIndex]?.content.length ?? 0;

  useEffect(() => {
    if (lastIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    list.resetAfterIndex(lastIndex);
    list.scrollToItem(lastIndex, 'end');
  }, [lastIndex, lastContentLen, isStreaming]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-4">
      {messages.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">Start a conversation</p>
      ) : (
        <VariableSizeList
          ref={listRef}
          height={height}
          width="100%"
          itemCount={messages.length}
          itemSize={itemSizeGetter(messages)}
          itemData={{ messages }}
          overscanCount={4}
        >
          {MessageRow}
        </VariableSizeList>
      )}
      {isStreaming && <StreamIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

interface ChatFooterProps {
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled: boolean;
  voice: ReturnType<typeof useVoiceConversation>;
  pendingAttachments: AttachmentData[];
  onAttach: (items: AttachmentData[]) => void;
  onRemoveAttachment: (idx: number) => void;
  lastUsage: { inputTokens?: number; outputTokens?: number } | null;
  totalTokens: number;
}
function ChatFooter({
  input,
  onInputChange,
  onSend,
  onStop,
  disabled,
  voice,
  pendingAttachments,
  onAttach,
  onRemoveAttachment,
  lastUsage,
  totalTokens,
}: ChatFooterProps) {
  const [attachError, setAttachError] = useState<string | null>(null);
  const toggleVoice = () => {
    if (voice.state === 'idle') void voice.start();
    else voice.stop();
  };
  return (
    <div className="border-t p-4">
      {voice.error && (
        <p role="alert" className="text-destructive mb-2 text-sm">
          {voice.error}
        </p>
      )}
      {attachError && (
        <p role="alert" className="text-destructive mb-2 text-sm">
          {attachError}
        </p>
      )}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid="attachment-previews">
          {pendingAttachments.map((att, i) => (
            <span key={i} className="bg-muted flex items-center gap-1 rounded px-2 py-1 text-xs">
              {att.filename}
              <button
                type="button"
                aria-label={`Remove ${att.filename}`}
                onClick={() => onRemoveAttachment(i)}
                className="hover:text-destructive ml-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3">
        <VoiceOrb state={voice.state} onClick={toggleVoice} />
        <div className="flex-1">
          <ChatInput
            value={input}
            onChange={onInputChange}
            onSend={onSend}
            onStop={onStop}
            disabled={disabled}
          />
        </div>
        <AttachmentDropzone
          disabled={disabled}
          onAttach={(items) => {
            setAttachError(null);
            onAttach(items);
          }}
          onError={(msg) => setAttachError(msg)}
        />
      </div>
      {(lastUsage || totalTokens > 0) && (
        <div className="text-muted-foreground mt-1 flex items-center justify-end gap-3 text-xs">
          {lastUsage && (
            <span>
              last: {(lastUsage.inputTokens ?? 0) + (lastUsage.outputTokens ?? 0)} tok
            </span>
          )}
          {totalTokens > 0 && <span>session: {totalTokens} tok</span>}
        </div>
      )}
    </div>
  );
}

interface Props {
  model?: string;
  sessionId?: string;
}

const MODEL_STORAGE_KEY = 'wolfkrow.chat.model.v1';

function readPersistedModel(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? fallback;
}

export function ChatView({ model: initialModel = DEFAULT_CHAT_MODEL, sessionId }: Props) {
  // EPIC 3.1 — model is in-chat state (picker), persisted across sessions so
  // reopening chat keeps the last-used model. useChatStream depends on `model`,
  // so the next send uses the newly selected model.
  const [model, setModel] = useState(() => readPersistedModel(initialModel));
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    messages,
    input,
    setInput,
    isStreaming,
    sessionTitle,
    send,
    stop,
    clear,
    appendMessage,
    bottomRef,
    pendingAttachments,
    setPendingAttachments,
    pendingPermission,
    resolvePermission,
    pendingQuestion,
    answerQuestion,
    dismissQuestion,
    lastUsage,
    totalTokens,
  } = useChatSession(model, sessionId);
  const voice = useVoiceConversation({
    onMessage: (msg) => appendMessage(voiceMessageToDisplay(msg)),
  });
  const handleClearConfirm = () => {
    clear();
    setConfirmOpen(false);
  };
  const handleAttach = useCallback(
    (items: AttachmentData[]) => {
      setPendingAttachments((prev) => [...prev, ...items]);
    },
    [setPendingAttachments]
  );
  const handleRemoveAttachment = useCallback(
    (idx: number) => {
      setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
    },
    [setPendingAttachments]
  );
  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        title={sessionTitle}
        model={model}
        onModelChange={setModel}
        onClear={() => setConfirmOpen(true)}
      />
      <ChatTranscript messages={messages} isStreaming={isStreaming} bottomRef={bottomRef} />
      <ChatFooter
        input={input}
        onInputChange={setInput}
        onSend={send}
        onStop={stop}
        disabled={isStreaming}
        voice={voice}
        pendingAttachments={pendingAttachments}
        onAttach={handleAttach}
        onRemoveAttachment={handleRemoveAttachment}
        lastUsage={lastUsage}
        totalTokens={totalTokens}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Clear chat?"
        description="All messages will be removed."
        onConfirm={handleClearConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      {pendingPermission && (
        <ConfirmDialog
          open={true}
          title={`Allow tool: ${pendingPermission.name}?`}
          description={pendingPermission.prompt}
          onConfirm={() => resolvePermission(pendingPermission.callId, true)}
          onCancel={() => resolvePermission(pendingPermission.callId, false)}
        />
      )}
      <HumanQuestionDialog
        question={pendingQuestion}
        onAnswer={(questionId, answer) => answerQuestion(questionId, answer)}
        onDismiss={dismissQuestion}
      />
    </div>
  );
}
