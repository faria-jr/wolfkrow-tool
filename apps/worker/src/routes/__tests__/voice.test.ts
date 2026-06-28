/**
 * Voice routes — TTS synthesize + stream + key/validation branches.
 *
 * The /transcribe multipart path needs file plumbing and is not covered.
 * /synthesize and /synthesize/stream drive createTtsProvider + getSecret,
 * both mocked so no real HTTP/keychain is hit. Covers the 503 (no key),
 * 400 (no text), default-provider, custom voice/model, and the
 * streamSynthesize fallback branches.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { fakeKeychain, fakeTts } = vi.hoisted(() => {
  const fakeKeychain = { getSecret: vi.fn() };
  const fakeTts = {
    synthesize: vi.fn(async () => Buffer.from([1, 2, 3, 4])),
    streamSynthesize: undefined as undefined | (() => AsyncIterable<Buffer>),
  };
  return { fakeKeychain, fakeTts };
});

vi.mock('../../lib/keychain', () => fakeKeychain);
vi.mock('../../voice/factory', () => ({
  createTtsProvider: vi.fn(() => fakeTts),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { voiceRoutes } from '../voice';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await voiceRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('voice POST /synthesize', () => {
  it('returns audio when the provider key is configured', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce('sk-elevenlabs');
    fakeTts.synthesize.mockResolvedValueOnce(Buffer.from([9, 9]));
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize',
      payload: { text: 'hello', voice: 'v1', model: 'm1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(res.body.length).toBe(2);
  });

  it('uses the default provider (elevenlabs) when omitted', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce('sk');
    fakeTts.synthesize.mockResolvedValueOnce(Buffer.from([1]));
    const res = await app.inject({ method: 'POST', url: '/synthesize', payload: { text: 'hi' } });
    expect(res.statusCode).toBe(200);
    expect(fakeKeychain.getSecret).toHaveBeenCalledWith('elevenlabs-api-key');
  });

  it('returns 503 when the provider key is not configured', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'POST', url: '/synthesize', payload: { text: 'hi' } });
    expect(res.statusCode).toBe(503);
  });

  it('returns 400 when text is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/synthesize', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('voice POST /synthesize/stream', () => {
  it('streams chunks when the provider supports streamSynthesize', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce('sk');
    fakeTts.streamSynthesize = async function* () {
      yield Buffer.from([1]);
      yield Buffer.from([2]);
    };
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize/stream',
      payload: { text: 'hi', voice: 'v1' },
    });
    expect(res.statusCode).toBe(200);
    // The route streams via reply.raw (chunked) — both buffered chunks arrive.
    expect(res.body.length).toBe(2);
  });

  it('falls back to synthesize when streamSynthesize is unavailable', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce('sk');
    fakeTts.streamSynthesize = undefined;
    fakeTts.synthesize.mockResolvedValueOnce(Buffer.from([7, 7, 7]));
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize/stream',
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('returns 503 when the provider key is not configured', async () => {
    fakeKeychain.getSecret.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize/stream',
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('returns 400 when text is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/synthesize/stream', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

// ---- Authentication is enforced (default-user leak class of P0-7/P2-1):
// voice routes invoke paid external APIs, so anonymous abuse must be blocked. ----
describe('voice routes — authentication required', () => {
  it('POST /synthesize without credentials → 401', async () => {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await voiceRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    const res = await a.inject({ method: 'POST', url: '/synthesize', payload: { text: 'hi' } });
    expect(res.statusCode).toBe(401);
    await a.close();
  });
});
