/**
 * Enrich routes — session lifecycle (create/list/get/cancel) + 404 paths.
 *
 * The validate/enrich endpoints invoke AI and are covered only at the
 * validation boundary (validation-400.test.ts). This file covers the pure
 * session CRUD paths + ownership 404, mocking getRepos().enrichSession and the
 * keychain/adapter factories so importing enrich.ts does not pull real AI.
 */

import { EnrichSession } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


const { sessions, fakeEnrichRepo } = vi.hoisted(() => {
  const sessions = new Map<string, EnrichSession>();
  const fakeEnrichRepo = {
    findById: async (id: string) => sessions.get(id) ?? null,
    findByUserId: async (userId: string) =>
      [...sessions.values()].filter((s) => s.userId === userId),
    save: async (s: EnrichSession) => {
      sessions.set(s.id, s);
      return s;
    },
    delete: async (id: string) => {
      sessions.delete(id);
    },
  };
  return { sessions, fakeEnrichRepo };
});

vi.mock('../../container', () => ({ getRepos: () => ({ enrichSession: fakeEnrichRepo }) }));
vi.mock('../../lib/keychain', () => ({ getAnthropicApiKey: vi.fn(async () => 'sk-test') }));
vi.mock('../../container', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getRepos: () => ({ enrichSession: fakeEnrichRepo }) };
});

import type { AuthFastifyInstance } from '../../types/fastify';
import { enrichRoutes } from '../enrich';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  sessions.clear();
  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await enrichRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('enrich POST /sessions — create', () => {
  it('creates an enrich session and returns its props', async () => {
    const res = await app.inject({
      method: 'POST', url: '/sessions',
      payload: { specPath: '/tmp/spec.md' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { userId: string; specPath: string };
    expect(body.userId).toBe('u1');
    expect(body.specPath).toBe('/tmp/spec.md');
  });

  it('rejects a body missing specPath → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/sessions', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('accepts optional validatorAgentId + enricherAgentId', async () => {
    const res = await app.inject({
      method: 'POST', url: '/sessions',
      payload: { specPath: '/tmp/x.md', validatorAgentId: 'v1', enricherAgentId: 'e1' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('enrich POST /sessions — userId derived from session (IDOR)', () => {
  it('ignores a spoofed userId in the body and operates as the session user', async () => {
    // Authenticated user (u1) sends userId: 'victim' in the body to try to
    // create a session owned by 'victim'. The session MUST be owned by u1.
    const res = await app.inject({
      method: 'POST', url: '/sessions',
      payload: { userId: 'victim', specPath: '/tmp/spoof.md' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { userId: string; specPath: string };
    expect(body.userId).toBe('u1');
    expect(body.userId).not.toBe('victim');
  });
});

describe('enrich GET /sessions — list', () => {
  it('returns sessions for the authenticated user', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { userId: string }[];
    expect(body.some((s) => s.userId === 'u1')).toBe(true);
  });
});

describe('enrich GET /sessions/:id', () => {
  it('returns the session when found', async () => {
    const existing = [...sessions.values()][0]!;
    const res = await app.inject({ method: 'GET', url: `/sessions/${existing.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string };
    expect(body.id).toBe(existing.id);
  });

  it('returns 404 when not found', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('enrich DELETE /sessions/:id — cancel', () => {
  it('cancels an owned session and returns 204', async () => {
    const existing = [...sessions.values()][0]!;
    const res = await app.inject({ method: 'DELETE', url: `/sessions/${existing.id}` });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when cancelling a session owned by another user', async () => {
    const other = EnrichSession.create({ userId: 'someone-else', specPath: '/x' });
    sessions.set(other.id, other);
    // Authenticated user is u1; the session belongs to someone-else → 404, and
    // a spoofed ?userId=someone-else query is ignored (userId from session).
    const res = await app.inject({ method: 'DELETE', url: `/sessions/${other.id}?userId=someone-else` });
    expect(res.statusCode).toBe(404);
  });
});

describe('enrich validate/enrich — 404 on missing session', () => {
  it('validate returns 404 when the session does not exist', async () => {
    const res = await app.inject({ method: 'POST', url: '/sessions/unknown/validate', payload: {} });
    expect(res.statusCode).toBe(404);
  });

  it('enrich rejects a body missing validatorOutput → 400', async () => {
    const existing = [...sessions.values()].find((s) => s.userId === 'someone-else')!;
    const res = await app.inject({
      method: 'POST', url: `/sessions/${existing.id}/enrich`, payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('enrich returns 404 when the session does not exist', async () => {
    const res = await app.inject({
      method: 'POST', url: '/sessions/unknown/enrich', payload: { validatorOutput: 'feedback' },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---- Authentication is enforced (default-user leak class of P0-7/P2-1). ----
describe('enrich routes — authentication required', () => {
  it('POST /sessions without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await enrichRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({
      method: 'POST', url: '/sessions',
      payload: { specPath: '/tmp/s.md' },
    });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('GET /sessions without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await enrichRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({ method: 'GET', url: '/sessions' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });
});
