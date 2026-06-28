/**
 * Vault routes — comprehensive coverage (happy / error / crypto round-trip).
 *
 * Mocks getRepos().secret + getAdapters().secrets with in-memory fakes so the
 * route exercises the real use-cases (List/Store/GetValue/Delete) and the real
 * AES-256-GCM export/import crypto. A global onRequest hook stamps req.user
 * (mirrors the worker registering the auth plugin at app scope).
 */

import { Secret } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

// In-memory secret store + secrets adapter fakes.
const store = new Map<string, Secret>();

const fakeSecretRepo = {
  findAll: async (userId: string) => [...store.values()].filter((s) => s.userId === userId),
  findByKey: async (key: string) => store.get(key) ?? null,
  save: async (secret: Secret) => {
    store.set(secret.key, secret);
    return secret;
  },
  delete: async (key: string) => {
    store.delete(key);
  },
};

const fakeSecretsAdapter = {
  get: async (key: string) => (store.get(key) ? `value-for-${key}` : null),
  set: vi.fn(async () => undefined),
  delete: async (_key: string) => undefined,
};

vi.mock('../../container', () => ({
  getRepos: () => ({ secret: fakeSecretRepo }),
  getAdapters: () => ({ secrets: fakeSecretsAdapter }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { vaultRoutes } from '../vault';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  store.clear();
  const seeded = Secret.create({
    userId: 'u1',
    key: 'API_KEY',
    displayName: 'API Key',
    category: 'ai',
  });
  store.set(seeded.key, seeded);

  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await vaultRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('vault GET / — list', () => {
  it('returns the seeded secret as props (no value)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { secrets: { key: string; value?: string }[] };
    expect(body.secrets).toHaveLength(1);
    expect(body.secrets[0]!.key).toBe('API_KEY');
    // toProps never leaks the secret value.
    expect(body.secrets[0]!.value).toBeUndefined();
  });
});

describe('vault POST / — store', () => {
  it('creates a new secret and returns 201 with props', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        key: 'DB_PASSWORD',
        value: 'hunter2',
        displayName: 'DB Password',
        category: 'integration',
        description: 'primary db',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { secret: { key: string; displayName: string; category: string } };
    expect(body.secret.key).toBe('DB_PASSWORD');
    expect(body.secret.category).toBe('integration');
    expect(store.has('DB_PASSWORD')).toBe(true);
  });

  it('rotates an existing secret instead of duplicating (withRotated branch)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { key: 'API_KEY', value: 'rotated', displayName: 'API Key', category: 'ai' },
    });
    expect(res.statusCode).toBe(201);
    // Still only one entry for API_KEY.
    expect(store.get('API_KEY')!.displayName).toBe('API Key');
  });

  it('rejects an invalid category → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { key: 'x', value: 'y', displayName: 'd', category: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body missing required fields → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { key: 'x' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('vault GET /:key/masked — masking', () => {
  it('returns a masked value for an existing secret', async () => {
    const res = await app.inject({ method: 'GET', url: '/API_KEY/masked' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { masked: string };
    // mask() keeps the last 4 chars, prepends 8 bullets.
    // fake adapter returns `value-for-API_KEY` → last 4 = `_KEY`.
    expect(body.masked).toMatch(/^•{8}/);
    expect(body.masked.endsWith('_KEY')).toBe(true);
  });

  it('returns 404 for a missing secret', async () => {
    const res = await app.inject({ method: 'GET', url: '/NOPE/masked' });
    expect(res.statusCode).toBe(404);
  });
});

describe('vault DELETE /:key', () => {
  it('deletes a secret and returns ok', async () => {
    store.set(
      'TEMP_KEY',
      Secret.create({ userId: 'u1', key: 'TEMP_KEY', displayName: 't', category: 'other' })
    );
    const res = await app.inject({ method: 'DELETE', url: '/TEMP_KEY' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(store.has('TEMP_KEY')).toBe(false);
  });
});

describe('vault export/import — AES-256-GCM round-trip', () => {
  it('exports an encrypted payload, then re-imports the same secrets', async () => {
    const passphrase = 'correct-horse-battery-staple';

    const exportRes = await app.inject({
      method: 'POST',
      url: '/export',
      payload: { passphrase },
    });
    expect(exportRes.statusCode).toBe(200);
    const { payload } = exportRes.json() as {
      payload: { version: number; salt: string; iv: string; data: string };
    };
    expect(payload.version).toBe(1);
    expect(payload.salt).not.toBe('');
    expect(payload.iv).not.toBe('');
    expect(payload.data).not.toBe('');

    // Wipe the store so import actually re-creates entries.
    store.clear();

    const importRes = await app.inject({
      method: 'POST',
      url: '/import',
      payload: { passphrase, payload },
    });
    expect(importRes.statusCode).toBe(200);
    const body = importRes.json() as { imported: number };
    expect(body.imported).toBeGreaterThan(0);
    // The seeded API_KEY should be back in the store.
    expect(store.has('API_KEY')).toBe(true);
  });

  it('rejects import with a wrong passphrase → 400', async () => {
    const exportRes = await app.inject({
      method: 'POST',
      url: '/export',
      payload: { passphrase: 'right-pass' },
    });
    const { payload } = exportRes.json() as { payload: object };

    const res = await app.inject({
      method: 'POST',
      url: '/import',
      payload: { passphrase: 'wrong-pass', payload },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/passphrase|corrupt/i);
  });

  it('rejects export with missing passphrase → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/export', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

// ---- Authentication is enforced: anonymous callers get 401, never the
// 'default' user (default-user leak class of P0-7/P2-1). Vault secrets are the
// most sensitive user-scoped data, so this is the highest-stakes fix. Uses the
// real-behaving authenticate decorator so the rejection is genuine. ----
describe('vault routes — authentication required (default-user leak fix)', () => {
  async function buildRealAuthApp(): Promise<FastifyInstance> {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await vaultRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    return a;
  }

  it('GET / without credentials → 401', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('POST / without credentials → 401', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({
      method: 'POST',
      url: '/',
      payload: { key: 'k', value: 'v', displayName: 'd', category: 'ai' },
    });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('POST /export without credentials → 401', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({ method: 'POST', url: '/export', payload: { passphrase: 'x' } });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('GET / WITH credentials → 200 (real user, not default)', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({
      method: 'GET',
      url: '/',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.statusCode).toBe(200);
    await a.close();
  });
});
