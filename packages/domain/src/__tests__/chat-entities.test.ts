import { describe, expect, it } from 'vitest';

import { ChatSession, Message, TokenEstimator } from '../index';

// ── Message ─────────────────────────────────────────────────────────────────

describe('Message', () => {
  it('create generates id and createdAt', () => {
    const msg = Message.create({ sessionId: 's1', userId: 'u1', role: 'user', content: 'hello' });
    expect(msg.id).toBeTruthy();
    expect(msg.createdAt).toBeInstanceOf(Date);
    expect(msg.content).toBe('hello');
    expect(msg.role).toBe('user');
    expect(msg.sessionId).toBe('s1');
    expect(msg.userId).toBe('u1');
  });

  it('create generates unique ids', () => {
    const a = Message.create({ sessionId: 's1', userId: 'u1', role: 'user', content: 'a' });
    const b = Message.create({ sessionId: 's1', userId: 'u1', role: 'user', content: 'b' });
    expect(a.id).not.toBe(b.id);
  });

  it('fromProps → toProps roundtrip', () => {
    const createdAt = new Date('2024-01-01');
    const msg = Message.fromProps({
      id: 'm1',
      sessionId: 's1',
      userId: 'u1',
      role: 'assistant',
      content: 'reply',
      createdAt,
    });
    expect(msg.toProps()).toEqual({ id: 'm1', sessionId: 's1', userId: 'u1', role: 'assistant', content: 'reply', createdAt });
  });

  it('supports all roles', () => {
    for (const role of ['user', 'assistant', 'system', 'tool'] as const) {
      const msg = Message.create({ sessionId: 's1', userId: 'u1', role, content: 'x' });
      expect(msg.role).toBe(role);
    }
  });
});

// ── ChatSession ──────────────────────────────────────────────────────────────

describe('ChatSession', () => {
  const base = { userId: 'u1', agentId: 'a1', title: undefined, archived: false } as const;

  it('create produces empty session with defaults', () => {
    const session = ChatSession.create(base);
    expect(session.id).toBeTruthy();
    expect(session.messages).toEqual([]);
    expect(session.archived).toBe(false);
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('create generates unique ids', () => {
    expect(ChatSession.create(base).id).not.toBe(ChatSession.create(base).id);
  });

  it('addMessage appends and is immutable', () => {
    const session = ChatSession.create(base);
    const msg = Message.create({ sessionId: session.id, userId: 'u1', role: 'user', content: 'hi' });
    const updated = session.addMessage(msg);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]).toBe(msg);
    expect(session.messages).toHaveLength(0);
  });

  it('messageCount reflects messages array', () => {
    let session = ChatSession.create(base);
    expect(session.messageCount).toBe(0);
    const msg = Message.create({ sessionId: session.id, userId: 'u1', role: 'user', content: 'hi' });
    session = session.addMessage(msg);
    expect(session.messageCount).toBe(1);
  });

  it('recordActivity updates lastActivity', () => {
    const session = ChatSession.create(base);
    const future = new Date(Date.now() + 60_000);
    const updated = session.recordActivity(future);
    expect(updated.lastActivity.getTime()).toBe(future.getTime());
    expect(session.lastActivity.getTime()).not.toBe(future.getTime());
  });

  it('archive sets archived flag immutably', () => {
    const session = ChatSession.create(base);
    const archived = session.archive();
    expect(archived.archived).toBe(true);
    expect(session.archived).toBe(false);
  });

  it('withMessages replaces message list', () => {
    const session = ChatSession.create(base);
    const msg = Message.create({ sessionId: session.id, userId: 'u1', role: 'user', content: 'hi' });
    const updated = session.withMessages([msg]);
    expect(updated.messages).toHaveLength(1);
    expect(session.messages).toHaveLength(0);
  });

  it('fromProps → toProps roundtrip', () => {
    const now = new Date('2024-01-01');
    const session = ChatSession.fromProps({ id: 's1', userId: 'u1', agentId: 'a1', title: 'Test', archived: false, messages: [], createdAt: now, updatedAt: now, lastActivity: now });
    const props = session.toProps();
    expect(props.id).toBe('s1');
    expect(props.title).toBe('Test');
    expect(props.messages).toEqual([]);
  });
});

// ── TokenEstimator ───────────────────────────────────────────────────────────

describe('TokenEstimator', () => {
  const estimator = new TokenEstimator();

  it('estimateFromText uses ~4 chars/token', () => {
    expect(estimator.estimateFromText('abcd')).toBe(1);
    expect(estimator.estimateFromText('a'.repeat(40))).toBe(10);
  });

  it('estimateFromText rounds up', () => {
    expect(estimator.estimateFromText('abc')).toBe(1);
    expect(estimator.estimateFromText('abcde')).toBe(2);
  });

  it('estimateFromMessages sums all content', () => {
    const msgs = [
      Message.create({ sessionId: 's1', userId: 'u1', role: 'user', content: 'a'.repeat(20) }),
      Message.create({ sessionId: 's1', userId: 'u1', role: 'assistant', content: 'b'.repeat(20) }),
    ];
    expect(estimator.estimateFromMessages(msgs)).toBe(10);
  });

  it('exceedsThreshold returns true when over limit', () => {
    const msgs = [Message.create({ sessionId: 's1', userId: 'u1', role: 'user', content: 'a'.repeat(400) })];
    expect(estimator.exceedsThreshold(msgs, 50)).toBe(true);
    expect(estimator.exceedsThreshold(msgs, 200)).toBe(false);
  });

  it('exceedsThreshold false for empty messages', () => {
    expect(estimator.exceedsThreshold([], 100)).toBe(false);
  });
});
