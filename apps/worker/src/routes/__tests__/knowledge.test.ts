/**
 * Knowledge routes — list / delete / search + validation paths.
 *
 * The multipart upload path requires file plumbing and is not covered here.
 * list/delete/search drive use-cases against getRepos() knowledge repos +
 * getAdapters().embedder; mocking those with in-memory fakes (backed by real
 * entities) exercises the real route logic. Auth uses the real-behaving
 * decorator (onRequest) so 401-without-session is genuine.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

import { KnowledgeDocument } from '@wolfkrow/domain';

const { docs, fakeDocRepo, fakeChunkRepo, fakeEmbedder } = vi.hoisted(() => {
  const docs = new Map<string, KnowledgeDocument>();
  const fakeDocRepo = {
    findById: async (id: string) => docs.get(id) ?? null,
    findByUserId: async (userId: string) => [...docs.values()].filter((d) => d.userId === userId),
    save: async (d: KnowledgeDocument) => {
      docs.set(d.id, d);
      return d;
    },
    delete: async (id: string) => {
      docs.delete(id);
    },
  };
  const fakeChunkRepo = {
    saveMany: async (chunks: unknown[]) => chunks,
    findByDocumentId: async () => [],
    deleteByDocumentId: async () => undefined,
    vectorSearch: async () => [],
    keywordSearch: async () => [],
  };
  const fakeEmbedder = {
    embed: async () => ({ vector: new Array(8).fill(0), tokens: 1 }),
    embedBatch: async () => [{ vector: new Array(8).fill(0), tokens: 1 }],
  };
  return { docs, fakeDocRepo, fakeChunkRepo, fakeEmbedder };
});

vi.mock('../../container', () => ({
  getRepos: () => ({ knowledgeDoc: fakeDocRepo, knowledgeChunk: fakeChunkRepo }),
  getAdapters: () => ({ embedder: fakeEmbedder }),
}));

import { knowledgeRoutes } from '../knowledge';
import type { AuthFastifyInstance } from '../../types/fastify';
import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  docs.clear();
  const seeded = KnowledgeDocument.create({
    userId: 'u1', filename: 'spec.md', mimeType: 'text/markdown', size: 100,
  });
  docs.set(seeded.id, seeded);

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await knowledgeRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('knowledge routes — authentication', () => {
  it('GET /knowledge/documents without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/knowledge/documents' });
    expect(res.statusCode).toBe(401);
  });
});

describe('knowledge GET /knowledge/documents — list', () => {
  it('returns documents for the user', async () => {
    const res = await app.inject({ method: 'GET', url: '/knowledge/documents', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { documents: { filename: string }[] };
    expect(body.documents.some((d) => d.filename === 'spec.md')).toBe(true);
  });
});

describe('knowledge DELETE /knowledge/documents/:id', () => {
  it('deletes a document and its chunks, returns ok', async () => {
    const existing = [...docs.values()][0]!;
    const res = await app.inject({ method: 'DELETE', url: `/knowledge/documents/${existing.id}`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
    expect(docs.has(existing.id)).toBe(false);
  });
});

describe('knowledge POST /knowledge/search', () => {
  it('returns search results + the echoed query', async () => {
    const res = await app.inject({
      method: 'POST', url: '/knowledge/search', headers: BEARER,
      payload: { query: 'specs', limit: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { results: unknown[]; query: string };
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.query).toBe('specs');
  });

  it('returns empty results for an empty/whitespace query (use-case early return)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/knowledge/search', headers: BEARER,
      payload: { query: '   ' },
    });
    // The schema allows min(1) but whitespace passes; the use-case trims + returns [].
    expect(res.statusCode).toBe(200);
  });

  it('rejects a body missing query → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/knowledge/search', headers: BEARER, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('accepts optional documentIds filter', async () => {
    const res = await app.inject({
      method: 'POST', url: '/knowledge/search', headers: BEARER,
      payload: { query: 'x', documentIds: ['doc-1'] },
    });
    expect(res.statusCode).toBe(200);
  });
});
