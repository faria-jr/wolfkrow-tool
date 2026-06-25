/**
 * P1-1 — boundary validation tests.
 *
 * Each newly-validated route rejects an invalid body with 400 via the shared
 * `validate()` helper (which throws ValidationError → Fastify setErrorHandler
 * → 400). These tests confirm the Zod→400 mapping is wired at every boundary.
 */

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthFastifyInstance } from '../../types/fastify';
import { ValidationError } from '../../validation';
import { memoryRoutes } from '../memory';
import { mgraphRoutes } from '../mgraph';
import { vaultRoutes } from '../vault';

// --- Shared harness -------------------------------------------------------

/**
 * The worker's global setErrorHandler maps `error.statusCode` → HTTP status.
 * These tests register that handler so ValidationError surfaces as 400 exactly
 * as it does in production (server.ts).
 */
function setErrorHandler(app: ReturnType<typeof Fastify>) {
  app.setErrorHandler((error: Error, _request: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
    const err = error as Error & { statusCode?: number; code?: string };
    reply.status(err.statusCode ?? 500).send({
      error: err.message,
      code: err.code ?? 'INTERNAL_ERROR',
    });
  });
}

/**
 * Build a minimal Fastify app that registers only the plugin under test plus
 * the production error handler. `authenticate` is a no-op so requests reach
 * the handler.
 */
async function buildApp(
  register: (server: AuthFastifyInstance) => Promise<void>,
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();
  await app.register(async (instance) => {
    // authenticate stub sets a user so handlers that read req.user don't throw
    // before reaching the validation boundary.
    instance.decorate('authenticate', async (request: { user?: { userId?: string } }) => {
      request.user = { userId: 'u1' };
    });
    await register(instance as AuthFastifyInstance);
  });
  setErrorHandler(app);
  await app.ready();
  return app;
}

const emptyRepos = {
  secret: { findById: vi.fn(), findAll: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  semanticMemory: { add: vi.fn(), search: vi.fn(), findByUserId: vi.fn(), delete: vi.fn() },
  dailySummary: { findByUserId: vi.fn(), upsert: vi.fn() },
  scheduledTask: { findById: vi.fn(), findAll: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  taskRun: { findById: vi.fn(), findByTaskId: vi.fn(), upsert: vi.fn(), findAwaitingReview: vi.fn() },
  mcpServer: {},
  mcpToolRegistry: {},
};

// --- vault ----------------------------------------------------------------

vi.mock('../../container', () => ({
  getRepos: () => emptyRepos,
  getAdapters: () => ({ secrets: { get: vi.fn(), set: vi.fn() } }),
}));

describe('vault POST / — 400 on invalid body', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp(vaultRoutes);
  });

  it('rejects a body missing required fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { key: 'x' } });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid category enum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { key: 'k', value: 'v', displayName: 'd', category: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('vault POST /export — 400 on missing passphrase', () => {
  it('rejects an empty body', async () => {
    const app = await buildApp(vaultRoutes);
    const res = await app.inject({ method: 'POST', url: '/export', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

// --- memory ---------------------------------------------------------------

describe('memory POST /memory — 400 on invalid body', () => {
  it('rejects a body missing content', async () => {
    const app = await buildApp(async (server) => {
      await memoryRoutes(server);
    });
    const res = await app.inject({ method: 'POST', url: '/memory', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid source enum', async () => {
    const app = await buildApp(memoryRoutes);
    const res = await app.inject({
      method: 'POST',
      url: '/memory',
      payload: { content: 'hello', source: 'not-a-source' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// --- mgraph ---------------------------------------------------------------

describe('mgraph POST /mgraph/notes — 400 on invalid body', () => {
  it('rejects a body missing required fields', async () => {
    const app = await buildApp(mgraphRoutes);
    const res = await app.inject({ method: 'POST', url: '/mgraph/notes', payload: { path: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid kind enum', async () => {
    const app = await buildApp(mgraphRoutes);
    const res = await app.inject({
      method: 'POST',
      url: '/mgraph/notes',
      payload: { path: 'x', kind: 'bogus', title: 't', body: 'b' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// --- ValidationError contract ---------------------------------------------

describe('ValidationError maps to statusCode 400', () => {
  it('exposes statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});
