/**
 * Auth plugin — real authenticate decorator behavior.
 *
 * Registers the actual authPlugin (the production decorator) and verifies the
 * three branches: missing header → 401, malformed token → 401, valid token →
 * req.user populated. jose.jwtVerify is mocked so no remote JWKS fetch is
 * needed, but the decorator itself is the REAL production code.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

vi.mock('jose', () => ({
  createRemoteJWCSet: vi.fn(),
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

vi.mock('@wolfkrow/infra/repos', () => ({
  createRepoRegistry: vi.fn(() => ({
    user: { findOwner: vi.fn().mockResolvedValue({ id: 'owner-1' }) },
  })),
  resetRepoRegistry: vi.fn(),
}));

vi.mock('../../config', () => ({
  config: {
    JWKS_URL: 'https://example/.well-known/jwks.json',
    WOLFKROW_SHARED_WORKSPACE: 'true',
  },
}));

import { config } from '../../config';
import { authPlugin } from '../auth';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(authPlugin);
  // A probe route that returns 200 with the authenticated userId (or 401 from
  // the decorator's preHandler-style call).
  app.get('/probe', { preHandler: [app.authenticate] }, async (req) => ({
    userId: req.user?.userId ?? null,
    sub: req.user?.sub ?? null,
  }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('auth plugin — authenticate decorator', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/authorization/i);
  });

  it('returns 401 when the token fails verification', async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error('bad signature'));
    const res = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Bearer malformed.token.here' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/invalid/i);
  });

  it('populates req.user with owner id and preserves token sub when shared workspace is on', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-42', iss: 'wolfkrow', aud: 'wolfkrow-worker' },
    } as never);
    const res = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Bearer valid.token.here' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe('owner-1');
    expect(res.json().sub).toBe('user-42');
    // jwtVerify was called with the expected issuer/audience constraints.
    expect(jwtVerify).toHaveBeenCalledWith(
      'valid.token.here',
      expect.anything(),
      expect.objectContaining({ issuer: 'wolfkrow', audience: 'wolfkrow-worker' })
    );
  });

  it('uses token sub as userId when shared workspace is disabled', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-42', iss: 'wolfkrow', aud: 'wolfkrow-worker' },
    } as never);
    config.WOLFKROW_SHARED_WORKSPACE = 'false';
    const res = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Bearer valid.token.here' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe('user-42');
    expect(res.json().sub).toBe('user-42');
    config.WOLFKROW_SHARED_WORKSPACE = 'true';
  });
});
