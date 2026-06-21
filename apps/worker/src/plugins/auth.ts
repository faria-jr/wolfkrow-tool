/**
 * JWT authentication plugin.
 *
 * Valida tokens via JWKS do web (endpoint dedicado /.well-known/jwks.json),
 * URL por config (corrige G2 — antes hardcoded p/ o GET do login, com keypair
 * efêmero que invalidava tokens a cada restart). jose createRemoteJWKSet
 * busca, cacheia e refetcha automaticamente.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: { userId: string };
  }
}

const keySet = createRemoteJWKSet(new URL(config.JWKS_URL));

async function verifyBearer(request: FastifyRequest): Promise<string | null> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = await verifyBearer(request);
    if (!token) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: 'wolfkrow',
        audience: 'wolfkrow-worker',
      });
      request.user = { userId: payload.sub as string };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
});
