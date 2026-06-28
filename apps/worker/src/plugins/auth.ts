/**
 * JWT authentication plugin.
 *
 * Valida tokens via JWKS do web (endpoint dedicado /.well-known/jwks.json),
 * URL por config (corrige G2 — antes hardcoded p/ o GET do login, com keypair
 * efêmero que invalidava tokens a cada restart). jose createRemoteJWKSet
 * busca, cacheia e refetcha automaticamente.
 */

import { createRepoRegistry } from '@wolfkrow/infra/repos';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: { userId: string; sub?: string };
  }
}

const keySet = createRemoteJWKSet(new URL(config.JWKS_URL));

let cachedOwnerId: string | null = null;

async function resolveOwnerId(): Promise<string | null> {
  if (cachedOwnerId) return cachedOwnerId;
  try {
    const owner = await createRepoRegistry().user.findOwner();
    const id = owner?.id ?? null;
    if (id) cachedOwnerId = id;
    return id;
  } catch (err) {
    console.error('[auth] resolveOwnerId failed — shared workspace userId resolution degraded:', err);
    return null;
  }
}

async function resolveEffectiveUserId(sub: string): Promise<string> {
  if (config.WOLFKROW_SHARED_WORKSPACE !== 'false') {
    const ownerId = await resolveOwnerId();
    if (ownerId) return ownerId;
    console.error('[auth] shared workspace ON but no owner found — falling back to sub:', sub);
  }
  return sub;
}

async function verifyBearer(request: FastifyRequest): Promise<string | null> {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  // Fallback: browser-direct calls (SSE streams) send the JWT as a cookie
  // via `credentials: 'include'` instead of an Authorization header.
  const cookie = request.headers.cookie;
  if (cookie) {
    const match = cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('session='));
    if (match) return match.slice('session='.length);
  }

  return null;
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    const token = await verifyBearer(request);
    if (!token) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: 'wolfkrow',
        audience: 'wolfkrow-worker',
      });
      const sub = payload.sub as string;
      request.user = { userId: await resolveEffectiveUserId(sub), sub };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
});
