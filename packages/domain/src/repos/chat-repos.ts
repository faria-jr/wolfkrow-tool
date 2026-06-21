
import type { ChatSession } from '../entities/chat-session';
import type { Message } from '../entities/message';

import type { Repository } from './index';

export interface ChatSessionRepo extends Repository<ChatSession, string> {
  findByUserId(userId: string): Promise<ChatSession[]>;
}

export interface MessageRepo {
  findBySessionId(sessionId: string): Promise<Message[]>;
  save(message: Message): Promise<Message>;
  deleteBySessionId(sessionId: string): Promise<void>;
}
