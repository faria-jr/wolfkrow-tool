/**
 * Sidecar lifecycle routes — happy paths.
 *
 * sidecar.ts wraps sidecarManager start/stop/getState. Mocking the manager
 * exercises the real route handlers (status shape, ok responses) without
 * spawning the sidecar process.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const fakeManager = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  getState: vi.fn(() => ({ running: true, pid: 123, startedAt: '2026-06-24T00:00:00Z' })),
}));

vi.mock('../../sidecar/manager', () => ({ sidecarManager: fakeManager }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { sidecarRoutes } from '../sidecar';

import { setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  setErrorHandler(app);
  await sidecarRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('sidecar POST /start', () => {
  it('starts the sidecar and returns its state', async () => {
    fakeManager.start.mockClear();
    const res = await app.inject({ method: 'POST', url: '/start' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; state: { running: boolean } };
    expect(body.ok).toBe(true);
    expect(body.state.running).toBe(true);
    expect(fakeManager.start).toHaveBeenCalled();
  });
});

describe('sidecar POST /stop', () => {
  it('stops the sidecar', async () => {
    fakeManager.stop.mockClear();
    const res = await app.inject({ method: 'POST', url: '/stop' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(fakeManager.stop).toHaveBeenCalled();
  });
});

describe('sidecar GET /status', () => {
  it('returns the current state', async () => {
    fakeManager.getState.mockReturnValueOnce({ running: false, pid: null, startedAt: null } as never);
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { state: { running: boolean } };
    expect(body.state.running).toBe(false);
  });
});
