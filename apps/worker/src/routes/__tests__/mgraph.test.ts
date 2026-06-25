/**
 * Mgraph routes — happy / error / auth paths against a real tmp vault.
 *
 * mgraph.ts builds a MgraphEngine per-request from WOLFKROW_VAULT_ROOT (tmp).
 * Auth uses the real-behaving decorator (preHandler). These tests exercise the
 * real create/read/update/delete/graph/search/stats pipeline against an actual
 * on-disk vault so the route's error mapping (404 missing note, 400 invalid
 * create) is genuinely validated.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import { mgraphRoutes } from '../mgraph';
import type { AuthFastifyInstance } from '../../types/fastify';
import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;
let vaultRoot: string;

beforeAll(async () => {
  vaultRoot = mkdtempSync(join(tmpdir(), 'wolfkrow-mgraph-'));
  process.env['WOLFKROW_VAULT_ROOT'] = vaultRoot;

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await mgraphRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  delete process.env['WOLFKROW_VAULT_ROOT'];
  rmSync(vaultRoot, { recursive: true, force: true });
});

describe('mgraph routes — authentication', () => {
  it('GET /mgraph/graph without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/mgraph/graph' });
    expect(res.statusCode).toBe(401);
  });
});

describe('mgraph notes CRUD', () => {
  it('POST /mgraph/notes creates a note and returns its JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mgraph/notes',
      headers: BEARER,
      payload: { path: 'entities/acme', kind: 'entity', title: 'Acme', body: 'A key entity.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { path: string; title: string };
    expect(body.title).toBe('Acme');
  });

  it('POST /mgraph/notes rejects an invalid kind → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/mgraph/notes', headers: BEARER,
      payload: { path: 'x', kind: 'bogus', title: 't', body: 'b' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /mgraph/notes/:path reads the note back', async () => {
    const res = await app.inject({
      method: 'GET', url: '/mgraph/notes/entities%2Facme', headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { title: string };
    expect(body.title).toBe('Acme');
  });

  it('GET /mgraph/notes/:path returns 404 for a missing note', async () => {
    const res = await app.inject({
      method: 'GET', url: '/mgraph/notes/notes/does-not-exist', headers: BEARER,
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /mgraph/notes/:path updates the note body/title', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/mgraph/notes/entities%2Facme', headers: BEARER,
      payload: { body: 'Updated body', title: 'Acme Corp' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { title: string; body: string };
    expect(body.title).toBe('Acme Corp');
    expect(body.body).toBe('Updated body');
  });

  it('DELETE /mgraph/notes/:path removes the note', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/mgraph/notes/entities%2Facme', headers: BEARER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('mgraph graph / search / stats', () => {
  it('GET /mgraph/graph returns graph data', async () => {
    const res = await app.inject({ method: 'GET', url: '/mgraph/graph', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toBeDefined();
  });

  it('GET /mgraph/search returns results array', async () => {
    const res = await app.inject({ method: 'GET', url: '/mgraph/search?q=acme', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /mgraph/stats returns stats object', async () => {
    const res = await app.inject({ method: 'GET', url: '/mgraph/stats', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { noteCount: number };
    expect(typeof body.noteCount).toBe('number');
  });
});
