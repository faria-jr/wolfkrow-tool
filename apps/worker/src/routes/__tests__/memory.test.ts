/**
 * Memory routes — happy / error / auth paths.
 *
 * memory.ts builds Add/List/Search/Delete/GenerateSummary use-cases per-request
 * from getRepos().semanticMemory + .dailySummary and getAdapters().embedder.
 * Mocking those with in-memory fakes (backed by real entities) exercises the
 * real route logic. Auth uses the real-behaving decorator (onRequest).
 */

import type { SemanticMemory } from '@wolfkrow/domain';
import { DailySummary } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


const { memories, summaries, fakeMemoryRepo, fakeSummaryRepo, fakeEmbedder } = vi.hoisted(() => {
  const memories = new Map<string, SemanticMemory>();
  const summaries = new Map<string, DailySummary>();
  const fakeMemoryRepo = {
    findById: async (id: string) => memories.get(id) ?? null,
    findByUserId: async (userId: string) => [...memories.values()].filter((m) => m.userId === userId),
    save: async (m: SemanticMemory) => {
      memories.set(m.id, m);
      return m;
    },
    delete: async (id: string) => {
      memories.delete(id);
    },
    deleteByUserId: async (userId: string) => {
      for (const [id, m] of memories) if (m.userId === userId) memories.delete(id);
    },
    vectorSearch: async () => [] as { memory: SemanticMemory; distance: number }[],
    hybridSearch: async () => [] as { memory: SemanticMemory; distance: number }[],
  };
  const fakeSummaryRepo = {
    findByUserIdAndDate: async () => null,
    findByUserId: async (userId: string) => [...summaries.values()].filter((s) => s.userId === userId),
    save: async (s: DailySummary) => {
      summaries.set(`${s.userId}:${s.date}`, s);
      return s;
    },
  };
  const fakeEmbedder = {
    embed: async () => ({ vector: new Array(8).fill(0), tokens: 1 }),
    embedBatch: async () => [{ vector: new Array(8).fill(0), tokens: 1 }],
  };
  return { memories, summaries, fakeMemoryRepo, fakeSummaryRepo, fakeEmbedder };
});

vi.mock('../../container', () => ({
  getRepos: () => ({ semanticMemory: fakeMemoryRepo, dailySummary: fakeSummaryRepo }),
  getAdapters: () => ({ embedder: fakeEmbedder }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { memoryRoutes } from '../memory';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  memories.clear();
  summaries.clear();
  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await memoryRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('memory routes — authentication', () => {
  it('GET /memory without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/memory' });
    expect(res.statusCode).toBe(401);
  });
});

describe('memory POST /memory — add', () => {
  it('creates a memory and returns 201 with props', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory', headers: BEARER,
      payload: { content: 'remember this', source: 'user', importance: 80 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { memory: { content: string; source: string } };
    expect(body.memory.content).toBe('remember this');
    expect(body.memory.source).toBe('user');
  });

  it('applies defaults (source=user, importance=50)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory', headers: BEARER, payload: { content: 'x' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('accepts metadata (covers metadata spread branch)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory', headers: BEARER,
      payload: { content: 'with-meta', source: 'agent', importance: 90, metadata: { tag: 'x' } },
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects empty content → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/memory', headers: BEARER, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid source enum → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory', headers: BEARER,
      payload: { content: 'x', source: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('memory GET /memory — list', () => {
  it('returns memories for the user', async () => {
    const res = await app.inject({ method: 'GET', url: '/memory', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { memories: { content: string }[] };
    expect(body.memories.some((m) => m.content === 'remember this')).toBe(true);
  });
});

describe('memory POST /memory/search', () => {
  it('returns search results', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory/search', headers: BEARER,
      payload: { query: 'remember', limit: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { results: unknown[] };
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('works without an explicit limit (default branch)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory/search', headers: BEARER, payload: { query: 'x' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects empty query → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory/search', headers: BEARER, payload: { query: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('memory DELETE /memory/:id', () => {
  it('deletes a memory and returns ok', async () => {
    const existing = [...memories.values()][0]!;
    const res = await app.inject({ method: 'DELETE', url: `/memory/${existing.id}`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
  });
});

describe('memory summaries', () => {
  it('GET /memory/summaries returns summaries for the user', async () => {
    const seeded = DailySummary.create({
      userId: 'u1', date: '2026-06-24', content: 'A productive day',
      sessionCount: 0, messageCount: 0, tokensUsed: 0, cost: 0, metadata: {},
    });
    summaries.set('u1:2026-06-24', seeded);
    const res = await app.inject({ method: 'GET', url: '/memory/summaries', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { summaries: { date: string }[] };
    expect(body.summaries.some((s) => s.date === '2026-06-24')).toBe(true);
  });

  it('POST /memory/summaries creates a summary and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/memory/summaries', headers: BEARER,
      payload: { date: '2026-06-25', content: 'Manual note' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { summary: { date: string; content: string } };
    expect(body.summary.date).toBe('2026-06-25');
    expect(body.summary.content).toBe('Manual note');
  });

  it('POST /memory/summaries uses today + default content when body is empty', async () => {
    const res = await app.inject({ method: 'POST', url: '/memory/summaries', headers: BEARER, payload: {} });
    expect(res.statusCode).toBe(201);
  });
});
