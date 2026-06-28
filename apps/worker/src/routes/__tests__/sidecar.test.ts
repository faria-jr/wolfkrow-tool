/**
 * Sidecar lifecycle routes — auth guard + happy paths.
 */

import type { FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const fakeManager = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  getState: vi.fn(() => ({ running: true, pid: 123, startedAt: '2026-06-24T00:00:00Z' })),
}));

vi.mock('../../sidecar/manager', () => ({ sidecarManager: fakeManager }));

import { sidecarRoutes } from '../sidecar';

import { buildAppWithRealAuth, buildAuthedApp, authed } from './helpers/app';

let app: FastifyInstance;
let unauthApp: FastifyInstance;

beforeAll(async () => {
  app = await buildAuthedApp(sidecarRoutes);
  unauthApp = await buildAppWithRealAuth(sidecarRoutes);
});

afterAll(async () => {
  await app.close();
  await unauthApp.close();
});

describe('sidecar auth guard', () => {
  it('POST /start returns 401 without token', async () => {
    const res = await unauthApp.inject({ method: 'POST', url: '/start' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /stop returns 401 without token', async () => {
    const res = await unauthApp.inject({ method: 'POST', url: '/stop' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /status returns 401 without token', async () => {
    const res = await unauthApp.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /start returns 200 with token', async () => {
    const res = await unauthApp.inject(authed({ method: 'POST', url: '/start' }));
    expect(res.statusCode).toBe(200);
  });
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
    fakeManager.getState.mockReturnValueOnce({
      running: false,
      pid: null,
      startedAt: null,
    } as never);
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { state: { running: boolean } };
    expect(body.state.running).toBe(false);
  });
});
