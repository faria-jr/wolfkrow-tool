'use client';

import type { ToolCall } from './tool-call-inline';
import { ToolCallInline } from './tool-call-inline';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface DisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: Date;
}

interface Props {
  message: DisplayMessage;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      data-role={message.role}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.toolCalls?.map((tc) => (
          <ToolCallInline key={tc.id} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}
