import { ChatSession, Message } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { DrizzleChatSessionRepo, DrizzleMessageRepo } from '../chat-repos';

import { mockDb } from './mock-db';

const userId = 'user-1';
const sessionId = 'session-1';
const now = new Date('2026-01-01T00:00:00Z');

const sessionRow = {
  id: sessionId,
  userId,
  agentId: 'agent-1',
  title: 'Test',
  archived: 0,
  metadata: '{}',
  createdAt: now,
  updatedAt: now,
  lastActivity: now,
};

const messageRow = {
  id: 'msg-1',
  sessionId,
  userId,
  role: 'user' as const,
  content: 'Hello',
  attachments: '[]',
  toolCalls: '[]',
  toolResults: '[]',
  metadata: '{}',
  createdAt: now,
};

describe('DrizzleChatSessionRepo', () => {
  it('findById returns null when row absent', async () => {
    const { db } = mockDb([]);
    const repo = new DrizzleChatSessionRepo(db as never);
    const result = await repo.findById(sessionId);
    expect(result).toBeNull();
  });

  it('findById returns ChatSession when row present', async () => {
    const { db } = mockDb([sessionRow]);
    const repo = new DrizzleChatSessionRepo(db as never);
    const result = await repo.findById(sessionId);
    expect(result).toBeInstanceOf(ChatSession);
    expect(result?.id).toBe(sessionId);
    expect(result?.userId).toBe(userId);
  });

  it('findByUserId returns array of ChatSession', async () => {
    const { db } = mockDb([sessionRow]);
    const repo = new DrizzleChatSessionRepo(db as never);
    const results = await repo.findByUserId(userId);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(ChatSession);
  });

  it('save upserts and returns session', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleChatSessionRepo(db as never);
    const session = ChatSession.create({ userId, agentId: 'agent-1', title: 'T', archived: false });
    const saved = await repo.save(session);
    expect(chain.run).toHaveBeenCalled();
    expect(saved).toBeInstanceOf(ChatSession);
    expect(saved.id).toBe(session.id);
  });

  it('delete calls db.delete', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleChatSessionRepo(db as never);
    await repo.delete(sessionId);
    expect(chain.run).toHaveBeenCalled();
  });
});

describe('DrizzleMessageRepo', () => {
  it('findBySessionId returns array of Messages', async () => {
    const { db } = mockDb([messageRow]);
    const repo = new DrizzleMessageRepo(db as never);
    const results = await repo.findBySessionId(sessionId);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Message);
    expect(results[0]?.content).toBe('Hello');
  });

  it('save upserts and returns message', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleMessageRepo(db as never);
    const msg = Message.create({ sessionId, userId, role: 'user', content: 'Hi' });
    const saved = await repo.save(msg);
    expect(chain.run).toHaveBeenCalled();
    expect(saved).toBeInstanceOf(Message);
    expect(saved.id).toBe(msg.id);
  });

  it('deleteBySessionId calls db.delete', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleMessageRepo(db as never);
    await repo.deleteBySessionId(sessionId);
    expect(chain.run).toHaveBeenCalled();
  });
});
