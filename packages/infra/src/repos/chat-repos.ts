import { ChatSession, Message, type ChatSessionRepo, type MessageRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { chatMessages, chatSessions } from '../db/schema/chat';

type Db = ReturnType<typeof getDb>;
type SessionRow = typeof chatSessions.$inferSelect;
type MessageRow = typeof chatMessages.$inferSelect;

export class DrizzleChatSessionRepo implements ChatSessionRepo {
  constructor(private readonly db: Db = getDb()) {}

  async findById(id: string): Promise<ChatSession | null> {
    const rows = this.db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1).all();
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<ChatSession[]> {
    const rows = this.db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).all();
    return rows.map((r) => this.toEntity(r));
  }

  async save(session: ChatSession): Promise<ChatSession> {
    const now = new Date();
    const agentId = session.agentId ?? '';
    const title = session.title ?? '';
    this.db
      .insert(chatSessions)
      .values({
        id: session.id,
        userId: session.userId,
        agentId,
        title,
        archived: session.archived,
        metadata: {},
        createdAt: session.createdAt,
        updatedAt: now,
        lastActivity: session.lastActivity,
      })
      .onConflictDoUpdate({
        target: chatSessions.id,
        set: {
          title,
          archived: session.archived,
          updatedAt: now,
          lastActivity: session.lastActivity,
          agentId,
        },
      })
      .run();
    return session;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(chatSessions).where(eq(chatSessions.id, id)).run();
  }

  private toEntity(row: SessionRow): ChatSession {
    return ChatSession.fromProps({
      id: row.id,
      userId: row.userId,
      agentId: row.agentId || undefined,
      title: row.title || undefined,
      archived: Boolean(row.archived),
      messages: [],
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      lastActivity: row.lastActivity instanceof Date ? row.lastActivity : new Date(row.lastActivity),
    });
  }
}

export class DrizzleMessageRepo implements MessageRepo {
  constructor(private readonly db: Db = getDb()) {}

  async findBySessionId(sessionId: string): Promise<Message[]> {
    const rows = this.db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).all();
    return rows.map((r) => this.toEntity(r));
  }

  async save(message: Message): Promise<Message> {
    this.db
      .insert(chatMessages)
      .values({
        id: message.id,
        sessionId: message.sessionId,
        userId: message.userId,
        role: message.role,
        content: message.content,
        attachments: [],
        toolCalls: [],
        toolResults: [],
        metadata: {},
        createdAt: message.createdAt,
      })
      .onConflictDoUpdate({
        target: chatMessages.id,
        set: { content: message.content, role: message.role },
      })
      .run();
    return message;
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    this.db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId)).run();
  }

  private toEntity(row: MessageRow): Message {
    return Message.fromProps({
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    });
  }
}
