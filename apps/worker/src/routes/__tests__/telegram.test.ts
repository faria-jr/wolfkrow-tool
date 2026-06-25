/**
 * Telegram routes — happy / error paths.
 *
 * telegram.ts reads a token via getSecret and drives telegramBridge. Mocking
 * the keychain + bridge exercises the real route logic (503 when no token,
 * 200 on start/stop/status, pairing-code generation, validation 400). Routes
 * require authentication (default-user leak class of P0-7/P2-1).
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { fakeKeychain, fakeBridge } = vi.hoisted(() => {
  const fakeKeychain = { getSecret: vi.fn() };
  const fakeBridge = {
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    isStarted: vi.fn(() => true),
    generatePairingCode: vi.fn(() => 'PAIR-1234'),
  };
  return { fakeKeychain, fakeBridge };
});

vi.mock('../../lib/keychain', () => fakeKeychain);
vi.mock('../../telegram/bridge', () => ({ telegramBridge: fakeBridge }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { telegramRoutes } from '../telegram';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await telegramRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('telegram POST /start', () => {
  it('starts the bridge when a token is configured', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce('bot-token');
    fakeBridge.start.mockClear();
    const res = await app.inject({ method: 'POST', url: '/start' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ started: true });
    expect(fakeBridge.start).toHaveBeenCalledWith('bot-token');
  });

  it('returns 503 when no token is configured', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/start' });
    expect(res.statusCode).toBe(503);
  });
});

describe('telegram POST /stop', () => {
  it('stops the bridge', async () => {
    fakeBridge.stop.mockClear();
    const res = await app.inject({ method: 'POST', url: '/stop' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ stopped: true });
    expect(fakeBridge.stop).toHaveBeenCalled();
  });
});

describe('telegram GET /status', () => {
  it('returns the bridge running state', async () => {
    fakeBridge.isStarted.mockReturnValueOnce(true);
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ running: true });
  });

  it('returns false when the bridge is stopped', async () => {
    fakeBridge.isStarted.mockReturnValueOnce(false);
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ running: false });
  });
});

describe('telegram POST /pair', () => {
  it('generates a pairing code for the authenticated user', async () => {
    fakeBridge.generatePairingCode.mockReturnValueOnce('PAIR-XYZ');
    const res = await app.inject({ method: 'POST', url: '/pair', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code: 'PAIR-XYZ' });
    // userId is derived from the session (authedDecorator stamps 'u1').
    expect(fakeBridge.generatePairingCode).toHaveBeenCalledWith('u1');
  });

  it('ignores a spoofed userId in the body and pairs as the session user (IDOR)', async () => {
    fakeBridge.generatePairingCode.mockReturnValueOnce('PAIR-SPOOF');
    const res = await app.inject({
      method: 'POST', url: '/pair', payload: { userId: 'victim' },
    });
    expect(res.statusCode).toBe(200);
    // The pairing code is minted for the authenticated user (u1), NOT 'victim'.
    expect(fakeBridge.generatePairingCode).toHaveBeenCalledWith('u1');
    expect(fakeBridge.generatePairingCode).not.toHaveBeenCalledWith('victim');
  });
});

// ---- Authentication is enforced (default-user leak class of P0-7/P2-1). ----
describe('telegram routes — authentication required', () => {
  it('GET /status without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await telegramRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('POST /start without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await telegramRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({ method: 'POST', url: '/start' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });
});
