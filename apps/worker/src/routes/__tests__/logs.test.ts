import Fastify from 'fastify';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

import type { AuthFastifyInstance } from '../../types/fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logsRoutes } from '../logs';
import { logBus } from '../../log/bus';

/**
 * Real-behaving authenticate decorator: mirrors production (plugins/auth.ts)
 * which requires a `Authorization: Bearer <token>` header. Used instead of a
 * no-op stub so the 401-without-session case is a genuine rejection, not a
 * skipped assertion.
 */
/**
 * Real-behaving authenticate decorator: mirrors production (plugins/auth.ts)
 * which requires a `Authorization: Bearer <token>` header. Must be `async` to
 * satisfy the Fastify onRequest hook contract. Used instead of a no-op stub so
 * the 401-without-session case is a genuine rejection, not a skipped assertion.
 */
const realAuthenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }
  request.user = { userId: 'u1' };
};

/**
 * Build a fresh Fastify app with the real-behaving authenticate decorator and
 * the logs routes registered. Each test that drives a live SSE connection gets
 * its own instance to avoid open-handle interference between `inject` and
 * `listen` on a shared app.
 */
async function buildApp() {
  const app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  await logsRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
  return app;
}

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('logs routes — authentication required', () => {
  it('GET /history without session → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/history' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /stream without session → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/stream' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /history with session → 200 and returns entries', async () => {
    // seed one entry so history is non-empty
    logBus.publish({ level: 'info', time: Date.now(), msg: 'test-entry', module: 'logs-test' });

    const res = await app.inject({
      method: 'GET',
      url: '/history',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { entries: { msg: string }[] };
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.entries.some((e) => e.msg === 'test-entry')).toBe(true);
  });

  it('GET /stream with session → 200 and opens text/event-stream', async () => {
    // Dedicated listening instance: SSE never ends, so we read the open-flush
    // frames over a real socket and then abort.
    const streamApp = await buildApp();
    const base = await streamApp.listen({ port: 0, host: '127.0.0.1' });
    try {
      // seed an entry so the open-flush (history 50) emits at least one data frame
      logBus.publish({ level: 'info', time: Date.now(), msg: 'stream-seed', module: 'logs-test' });

      const controller = new AbortController();
      const res = await fetch(`${base}/stream`, {
        headers: { authorization: 'Bearer test-token' },
        signal: controller.signal,
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let received = '';
      while (!received.includes('data:')) {
        const { value } = await reader.read();
        received += decoder.decode(value, { stream: true });
      }
      controller.abort(); // close the stream; we've seen the open-flush

      expect(received).toContain('data:');
      expect(received).toContain('stream-seed');
    } finally {
      await streamApp.close();
    }
  }, 15000);
});
