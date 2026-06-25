/**
 * Telegram routes — happy / error paths.
 *
 * telegram.ts reads a token via getSecret and drives telegramBridge. Mocking
 * the keychain + bridge exercises the real route logic (503 when no token,
 * 200 on start/stop/status, pairing-code generation, validation 400). Routes
 * have no auth hook (getUserId is not used here) so no 401 case.
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

import { setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
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
  it('generates a pairing code for the user', async () => {
    fakeBridge.generatePairingCode.mockReturnValueOnce('PAIR-XYZ');
    const res = await app.inject({
      method: 'POST', url: '/pair', payload: { userId: 'user-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code: 'PAIR-XYZ' });
    expect(fakeBridge.generatePairingCode).toHaveBeenCalledWith('user-1');
  });

  it('rejects a body missing userId → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/pair', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
