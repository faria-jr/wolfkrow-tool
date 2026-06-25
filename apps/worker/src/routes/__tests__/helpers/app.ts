/**
 * Shared test harness for route tests.
 *
 * Builds a Fastify app with either:
 *  - a REAL-behaving async authenticate decorator (mirrors plugins/auth.ts) so
 *    401-without-session is a genuine rejection, or
 *  - an authenticated decorator that populates req.user for happy/error paths.
 *
 * Mirrors the production error handler (server.ts) so ValidationError surfaces
 * as 400 exactly as in production.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthFastifyInstance } from '../../../types/fastify';

/**
 * Real-behaving authenticate decorator (mirrors plugins/auth.ts). Must be
 * `async` to satisfy the Fastify onRequest/preHandler contract. Rejects with
 * 401 when no `Authorization: Bearer <token>` header is present — a genuine
 * rejection, not a skipped assertion.
 */
export const realAuthenticate = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }
  request.user = { userId: 'u1' };
};

/** Authenticated decorator that stamps a known user onto the request. */
export const authedDecorator = async (request: { user?: { userId?: string } }): Promise<void> => {
  request.user = { userId: 'u1' };
};

/** Production-aligned error handler mapping error.statusCode → HTTP status. */
export function setErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: Error, _request: unknown, reply: { status: (c: number) => { send: (b: unknown) => void } }) => {
      const err = error as Error & { statusCode?: number; code?: string };
      reply.status(err.statusCode ?? 500).send({
        error: err.message,
        code: err.code ?? 'INTERNAL_ERROR',
      });
    },
  );
}

const BEARER = { authorization: 'Bearer test-token' };

/**
 * Build a minimal app registering a single route plugin with a real-behaving
 * authenticate decorator. Used for routes guarded by preHandler/onRequest auth.
 */
export async function buildAppWithRealAuth(
  register: (server: AuthFastifyInstance) => Promise<void>,
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(async (instance) => {
    instance.decorate('authenticate', realAuthenticate);
    await register(instance as unknown as AuthFastifyInstance);
  });
  setErrorHandler(app);
  await app.ready();
  return app;
}

/**
 * Build an app with the authenticated decorator (user already populated) for
 * happy/error-path tests where the 401 case is covered separately.
 */
export async function buildAuthedApp(
  register: (server: AuthFastifyInstance) => Promise<void>,
): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(async (instance) => {
    instance.decorate('authenticate', authedDecorator);
    await register(instance as unknown as AuthFastifyInstance);
  });
  setErrorHandler(app);
  await app.ready();
  return app;
}

/** Inject a request with the Bearer header present (for real-auth apps). */
export function authed(
  injectOpts: Record<string, unknown>,
): Record<string, unknown> {
  return { ...injectOpts, headers: { ...(injectOpts.headers as object | undefined), ...BEARER } };
}
