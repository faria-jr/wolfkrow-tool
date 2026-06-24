'use client';

import { DEFAULT_CHAT_MODEL } from '@wolfkrow/shared-types';
import { useCallback, useEffect, useState } from 'react';

import { AskQuestionDialog } from './ask-question-dialog';
import type { AttachmentData } from './attachment-dropzone';
import { AttachmentDropzone } from './attachment-dropzone';
import { useChatSession } from './chat-hooks';
import type { DisplayMessage } from './chat-message';
import { ChatMessage } from './chat-message';
import { ConfirmDialog } from './confirm-dialog';
import { StreamIndicator } from './stream-indicator';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceOrb } from '@/components/voice/voice-orb';
import type { VoiceConversationMessage } from '@/hooks/use-voice-conversation';
import { useVoiceConversation } from '@/hooks/use-voice-conversation';


function voiceMessageToDisplay(msg: VoiceConversationMessage): DisplayMessage {
  return { id: crypto.randomUUID(), role: msg.role, content: msg.text, createdAt: new Date() };
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

interface ChatInputProps { value: string; onChange: (v: string) => void; onSend: () => void; onStop: () => void; disabled: boolean; }
function ChatInput({ value, onChange, onSend, onStop, disabled }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="flex gap-2">
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} placeholder="Message (Enter to send, Shift+Enter for newline)" className="min-h-[44px] max-h-32 resize-none" disabled={disabled} aria-label="Chat input" />
      {disabled
        ? <Button onClick={onStop} aria-label="Stop" variant="destructive">Stop</Button>
        : <Button onClick={onSend} disabled={!value.trim()} aria-label="Send">Send</Button>}
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
}
function ChatFooter({ input, onInputChange, onSend, onStop, disabled, voice, pendingAttachments, onAttach, onRemoveAttachment }: ChatFooterProps) {
  const [attachError, setAttachError] = useState<string | null>(null);
  const toggleVoice = () => { if (voice.state === 'idle') void voice.start(); else voice.stop(); };
  return (
    <div className="border-t p-4">
      {voice.error && <p role="alert" className="mb-2 text-sm text-destructive">{voice.error}</p>}
      {attachError && <p role="alert" className="mb-2 text-sm text-destructive">{attachError}</p>}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid="attachment-previews">
          {pendingAttachments.map((att, i) => (
            <span key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
              {att.filename}
              <button type="button" aria-label={`Remove ${att.filename}`} onClick={() => onRemoveAttachment(i)} className="ml-1 hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3">
        <VoiceOrb state={voice.state} onClick={toggleVoice} />
        <div className="flex-1">
          <ChatInput value={input} onChange={onInputChange} onSend={onSend} onStop={onStop} disabled={disabled} />
        </div>
        <AttachmentDropzone
          disabled={disabled}
          onAttach={(items) => { setAttachError(null); onAttach(items); }}
          onError={(msg) => setAttachError(msg)}
        />
      </div>
    </div>
  );
}

interface Props { model?: string; sessionId?: string; }

export function ChatView({ model = DEFAULT_CHAT_MODEL, sessionId }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    messages, input, setInput, isStreaming, sessionTitle, pendingQuestion, dismissQuestion,
    send, stop, clear, answerQuestion, appendMessage, bottomRef,
    pendingAttachments, setPendingAttachments, pendingPermission, resolvePermission,
  } = useChatSession(model, sessionId);
  const voice = useVoiceConversation({ onMessage: (msg) => appendMessage(voiceMessageToDisplay(msg)) });
  const handleClearConfirm = () => { clear(); setConfirmOpen(false); };
  const handleAttach = useCallback((items: AttachmentData[]) => {
    setPendingAttachments((prev) => [...prev, ...items]);
  }, [setPendingAttachments]);
  const handleRemoveAttachment = useCallback((idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, [setPendingAttachments]);
  return (
    <div className="flex h-full flex-col">
      <ChatHeader title={sessionTitle} onClear={() => setConfirmOpen(true)} />
      <ChatTranscript messages={messages} isStreaming={isStreaming} bottomRef={bottomRef} />
      <ChatFooter
        input={input} onInputChange={setInput} onSend={send} onStop={stop} disabled={isStreaming}
        voice={voice} pendingAttachments={pendingAttachments} onAttach={handleAttach} onRemoveAttachment={handleRemoveAttachment}
      />
      <ConfirmDialog open={confirmOpen} title="Clear chat?" description="All messages will be removed." onConfirm={handleClearConfirm} onCancel={() => setConfirmOpen(false)} />
      {pendingQuestion !== null && (
        <AskQuestionDialog open={true} question={pendingQuestion} onAnswer={answerQuestion} onCancel={dismissQuestion} />
      )}
      {pendingPermission && (
        <ConfirmDialog
          open={true}
          title={`Allow tool: ${pendingPermission.name}?`}
          description={pendingPermission.prompt}
          onConfirm={() => resolvePermission(pendingPermission.callId, true)}
          onCancel={() => resolvePermission(pendingPermission.callId, false)}
        />
      )}
    </div>
  );
}
