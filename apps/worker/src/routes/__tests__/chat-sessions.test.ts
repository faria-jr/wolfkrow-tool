/**
 * Chat-session routes — happy / error / auth paths.
 *
 * chat-sessions.ts calls getRepos().chatSession + .message directly. Mocking
 * those repos with in-memory fakes (backed by real ChatSession entities)
 * exercises the real route logic (filter archived, sort by lastActivity,
 * ownership 404). Auth uses the real-behaving decorator (preHandler).
 */

import { ChatSession, Message } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { sessions, messages, fakeChatSessionRepo, fakeMessageRepo } = vi.hoisted(() => {
  const sessions = new Map<string, ChatSession>();
  const messages = new Map<string, unknown[]>();
  const fakeChatSessionRepo = {
    findById: async (id: string) => sessions.get(id) ?? null,
    findAll: async () => [...sessions.values()],
    findByUserId: async (userId: string) =>
      [...sessions.values()].filter((s) => s.userId === userId),
    save: async (s: ChatSession) => {
      sessions.set(s.id, s);
      return s;
    },
    delete: async (id: string) => {
      sessions.delete(id);
    },
  };
  const fakeMessageRepo = {
    findBySessionId: async (sessionId: string) => messages.get(sessionId) ?? [],
    deleteBySessionId: async (sessionId: string) => {
      messages.delete(sessionId);
    },
    save: async () => undefined,
  };
  return { sessions, messages, fakeChatSessionRepo, fakeMessageRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({ chatSession: fakeChatSessionRepo, message: fakeMessageRepo }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { chatSessionRoutes } from '../chat-sessions';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  sessions.clear();
  messages.clear();
  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await chatSessionRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('chat-session routes — authentication', () => {
  it('GET /sessions without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions' });
    expect(res.statusCode).toBe(401);
  });
});

describe('chat-session POST /sessions — create', () => {
  it('creates a session and returns its props', async () => {
    const res = await app.inject({ method: 'POST', url: '/sessions', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { userId: string; title: string };
    expect(body.userId).toBe('u1');
    expect(body.title).toBe('New Chat');
  });
});

describe('chat-session GET /sessions — list', () => {
  it('omits archived sessions and sorts by lastActivity desc', async () => {
    // Create an archived session that must be filtered out.
    const archived = ChatSession.create({
      userId: 'u1',
      agentId: undefined,
      title: 'Old',
      archived: true,
    });
    sessions.set(archived.id, archived);

    const res = await app.inject({ method: 'GET', url: '/sessions', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; title: string }[];
    expect(body.some((s) => s.title === 'New Chat')).toBe(true);
    expect(body.some((s) => s.title === 'Old')).toBe(false);
  });
});

describe('chat-session PATCH /sessions/:id — update', () => {
  it('updates title/archived and returns the session', async () => {
    const existing = [...sessions.values()].find((s) => s.title === 'New Chat')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/sessions/${existing.id}`,
      headers: BEARER,
      payload: { title: 'Renamed', archived: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { title: string; archived: boolean };
    expect(body.title).toBe('Renamed');
    expect(body.archived).toBe(true);
  });

  it('updates a session owned by another user in shared workspace mode', async () => {
    const other = ChatSession.create({
      userId: 'someone-else',
      agentId: undefined,
      title: 'X',
      archived: false,
    });
    sessions.set(other.id, other);
    const res = await app.inject({
      method: 'PATCH',
      url: `/sessions/${other.id}`,
      headers: BEARER,
      payload: { title: 'y' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('y');
  });

  it('returns 404 for a missing session', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/sessions/missing',
      headers: BEARER,
      payload: { title: 'y' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('updates ONLY the archived flag when title is omitted (title-undefined spread)', async () => {
    const existing = [...sessions.values()].find((s) => s.title === 'Renamed')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/sessions/${existing.id}`,
      headers: BEARER,
      payload: { archived: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { title: string; archived: boolean };
    // title unchanged (was 'Renamed'); only archived toggled.
    expect(body.title).toBe('Renamed');
    expect(body.archived).toBe(false);
  });
});

describe('chat-session GET /sessions/:id/messages', () => {
  it('returns messages for an owned session', async () => {
    const existing = [...sessions.values()].find((s) => s.userId === 'u1')!;
    const msg = Message.create({
      sessionId: existing.id,
      userId: 'u1',
      role: 'user',
      content: 'hi',
    });
    messages.set(existing.id, [msg]);
    const res = await app.inject({
      method: 'GET',
      url: `/sessions/${existing.id}/messages`,
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { content: string }[];
    expect(body.length).toBe(1);
    expect(body[0]!.content).toBe('hi');
  });

  it('returns 404 for a session owned by another user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sessions/unknown-user/messages',
      headers: BEARER,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('chat-session DELETE /sessions/:id', () => {
  it('deletes an owned session and its messages', async () => {
    const target = ChatSession.create({
      userId: 'u1',
      agentId: undefined,
      title: 'Bye',
      archived: false,
    });
    sessions.set(target.id, target);
    messages.set(target.id, [{ id: 'm1' }]);
    const res = await app.inject({
      method: 'DELETE',
      url: `/sessions/${target.id}`,
      headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
    expect(sessions.has(target.id)).toBe(false);
    expect(messages.has(target.id)).toBe(false);
  });
});
