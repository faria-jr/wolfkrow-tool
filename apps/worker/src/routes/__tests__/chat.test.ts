/**
 * Chat routes — permission + compact + send-validation paths.
 *
 * The full /send SSE stream is heavy (orchestrator + AI streaming) and is not
 * covered here. This file covers the pure-permission endpoint (resolve a
 * pending callId vs 404 for unknown), the /send 400-on-invalid-body path
 * (validation happens before the SSE stream opens), and /compact against a
 * short-history session (returns compacted:false without invoking AI).
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { fakeMessageRepo, fakeChatSessionRepo } = vi.hoisted(() => {
  const fakeMessageRepo = {
    findBySessionId: async () => [] as unknown[],
    deleteBySessionId: async () => undefined,
    save: async () => undefined,
  };
  const fakeChatSessionRepo = {
    findById: async () => null,
    findByUserId: async () => [],
    save: async () => undefined,
    delete: async () => undefined,
  };
  return { fakeMessageRepo, fakeChatSessionRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    message: fakeMessageRepo,
    chatSession: fakeChatSessionRepo,
    agent: { findById: async () => null },
    tokenUsage: { insert: async () => undefined },
  }),
  getChatWorkDir: () => '/tmp/wolfkrow-chat-test',
  resolveAgentStreamPort: vi.fn(),
}));

// recordChatTurn is a side-effect best suppressed.
vi.mock('../../memory/lifecycle', () => ({ recordChatTurn: vi.fn() }));

import { chatRoutes } from '../chat';
import { requestToolPermission } from '../../chat/permission-store';
import type { AuthFastifyInstance } from '../../types/fastify';
import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await chatRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('chat POST /permission — resolve a pending tool-permission request', () => {
  it('resolves a pending callId and returns resolved:true', async () => {
    // Park a pending permission so resolveToolPermission finds it.
    const pending = requestToolPermission('call-1');
    const res = await app.inject({
      method: 'POST', url: '/permission', headers: BEARER,
      payload: { callId: 'call-1', approved: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ resolved: true });
    // The parked promise resolves to the approved value.
    await expect(pending).resolves.toBe(true);
  });

  it('returns 404 when no pending permission exists for callId', async () => {
    const res = await app.inject({
      method: 'POST', url: '/permission', headers: BEARER,
      payload: { callId: 'unknown', approved: false },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a body missing callId → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/permission', headers: BEARER, payload: { approved: true },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('chat POST /send — validation before the SSE stream opens', () => {
  it('rejects an empty message → 400 (no stream opened)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/send', headers: BEARER, payload: { message: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body missing message → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/send', headers: BEARER, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('chat POST /sessions/:id/compact — short history (no AI)', () => {
  it('returns compacted:false when the session is under the token threshold', async () => {
    // fakeMessageRepo.findBySessionId returns [] → under threshold → no AI call.
    const res = await app.inject({
      method: 'POST', url: '/sessions/sess-1/compact', headers: BEARER, payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { compacted: boolean };
    expect(body.compacted).toBe(false);
  });
});
