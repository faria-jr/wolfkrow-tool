/**
 * In-memory stores for chat sessions and messages (A.3).
 * Real DB persistence (DrizzleChatSessionRepo) is A.4.
 */
import type { ChatSession, ChatSessionRepo, Message, MessageRepo } from '@wolfkrow/domain';

export class InMemoryChatSessionRepo implements ChatSessionRepo {
  private readonly store = new Map<string, ChatSession>();

  async findById(id: string): Promise<ChatSession | null> {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string): Promise<ChatSession[]> {
    return [...this.store.values()].filter((s) => s.userId === userId);
  }
  async save(session: ChatSession): Promise<ChatSession> {
    this.store.set(session.id, session);
    return session;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemoryMessageRepo implements MessageRepo {
  private readonly store = new Map<string, Message>();

  async findBySessionId(sessionId: string): Promise<Message[]> {
    return [...this.store.values()]
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async save(message: Message): Promise<Message> {
    this.store.set(message.id, message);
    return message;
  }
  async deleteBySessionId(sessionId: string): Promise<void> {
    for (const [id, msg] of this.store) {
      if (msg.sessionId === sessionId) this.store.delete(id);
    }
  }
}
