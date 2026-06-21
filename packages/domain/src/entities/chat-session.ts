import { randomUUID } from 'node:crypto';

import type { Message } from './message';

export interface ChatSessionProps {
  id: string;
  userId: string;
  agentId: string | undefined;
  title: string | undefined;
  archived: boolean;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
}

export type ChatSessionCreateInput = Pick<ChatSessionProps, 'userId' | 'agentId' | 'title' | 'archived'>;

export class ChatSession {
  readonly id: string;
  readonly userId: string;
  readonly agentId: string | undefined;
  readonly title: string | undefined;
  readonly archived: boolean;
  readonly messages: Message[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastActivity: Date;

  private constructor(props: ChatSessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.agentId = props.agentId;
    this.title = props.title;
    this.archived = props.archived;
    this.messages = props.messages;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.lastActivity = props.lastActivity;
  }

  static create(input: ChatSessionCreateInput): ChatSession {
    const now = new Date();
    return new ChatSession({
      ...input,
      id: randomUUID(),
      messages: [],
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
    });
  }

  static fromProps(props: ChatSessionProps): ChatSession {
    return new ChatSession(props);
  }

  toProps(): ChatSessionProps {
    return {
      id: this.id,
      userId: this.userId,
      agentId: this.agentId,
      title: this.title,
      archived: this.archived,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastActivity: this.lastActivity,
    };
  }

  get messageCount(): number {
    return this.messages.length;
  }

  addMessage(message: Message): ChatSession {
    const now = new Date();
    return ChatSession.fromProps({ ...this.toProps(), messages: [...this.messages, message], updatedAt: now, lastActivity: now });
  }

  withMessages(messages: Message[]): ChatSession {
    return ChatSession.fromProps({ ...this.toProps(), messages });
  }

  recordActivity(now: Date = new Date()): ChatSession {
    return ChatSession.fromProps({ ...this.toProps(), lastActivity: now, updatedAt: now });
  }

  archive(): ChatSession {
    return ChatSession.fromProps({ ...this.toProps(), archived: true, updatedAt: new Date() });
  }
}
