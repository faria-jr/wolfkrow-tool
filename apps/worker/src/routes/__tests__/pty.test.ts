/**
 * PTY routes — create/delete + validation paths.
 *
 * The WebSocket upgrade handler (handlePtyWs) needs a live WS client and a
 * real PTY; it is not covered here. The POST /pty (create) and DELETE /pty/:id
 * handlers + the input-validation boundary are covered by mocking ptyServer so
 * no real process is spawned.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const fakePtyServer = vi.hoisted(() => ({
  create: vi.fn(),
  kill: vi.fn(),
  has: vi.fn(() => true),
  write: vi.fn(),
  resize: vi.fn(),
  onData: vi.fn(() => () => undefined),
  onExit: vi.fn(() => () => undefined),
}));

vi.mock('../../pty/server', () => ({ ptyServer: fakePtyServer }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { ptyRoutes } from '../pty';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await ptyRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('pty POST /pty — create', () => {
  it('creates a session and returns the sessionId', async () => {
    fakePtyServer.create.mockClear();
    const res = await app.inject({
      method: 'POST', url: '/pty',
      payload: { id: 'sess-1', cols: 100, rows: 30 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string };
    expect(body.sessionId).toBe('sess-1');
    expect(fakePtyServer.create).toHaveBeenCalledWith('sess-1', expect.objectContaining({ cols: 100, rows: 30 }));
  });

  it('generates a sessionId when id is omitted', async () => {
    const res = await app.inject({ method: 'POST', url: '/pty', payload: {} });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string };
    expect(body.sessionId).toEqual(expect.any(String));
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it('rejects out-of-range cols → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/pty', payload: { cols: 1 } });
    expect(res.statusCode).toBe(400);
  });

  it('coerces string cols/rows from query-like bodies', async () => {
    fakePtyServer.create.mockClear();
    const res = await app.inject({ method: 'POST', url: '/pty', payload: { cols: '120', rows: '40' } });
    expect(res.statusCode).toBe(200);
    expect(fakePtyServer.create).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cols: 120, rows: 40 }));
  });
});

describe('pty DELETE /pty/:id', () => {
  it('kills the session and returns ok', async () => {
    fakePtyServer.kill.mockClear();
    const res = await app.inject({ method: 'DELETE', url: '/pty/sess-1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(fakePtyServer.kill).toHaveBeenCalledWith('sess-1');
  });
});

// ---- Authentication is enforced: PTY routes spawn interactive shells (RCE),
// the most severe instance of the default-user leak class. An anonymous caller
// must NEVER open a shell. Uses the real-behaving decorator (genuine 401). ----
describe('pty routes — authentication required (RCE guard)', () => {
  it('POST /pty without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await ptyRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    fakePtyServer.create.mockClear();
    const res = await a.inject({ method: 'POST', url: '/pty', payload: { id: 'x' } });
    expect(res.statusCode).toBe(401);
    // The ptyServer.create must never be reached for an anonymous caller.
    expect(fakePtyServer.create).not.toHaveBeenCalled();
    await a.close();
  });

  it('DELETE /pty/:id without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await ptyRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({ method: 'DELETE', url: '/pty/sess-1' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });
});
