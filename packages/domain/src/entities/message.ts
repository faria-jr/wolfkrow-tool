import { randomUUID } from 'node:crypto';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageProps {
  id: string;
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export type MessageCreateInput = Omit<MessageProps, 'id' | 'createdAt'>;

export class Message {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;

  private constructor(props: MessageProps) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.userId = props.userId;
    this.role = props.role;
    this.content = props.content;
    this.createdAt = props.createdAt;
  }

  static create(input: MessageCreateInput): Message {
    return new Message({ ...input, id: randomUUID(), createdAt: new Date() });
  }

  static fromProps(props: MessageProps): Message {
    return new Message(props);
  }

  toProps(): MessageProps {
    return {
      id: this.id,
      sessionId: this.sessionId,
      userId: this.userId,
      role: this.role,
      content: this.content,
      createdAt: this.createdAt,
    };
  }
}
