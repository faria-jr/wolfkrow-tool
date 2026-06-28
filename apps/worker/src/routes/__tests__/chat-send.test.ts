/**
 * Chat /send SSE — stream happy path covering writeStreamAsSse/makeAIAdapter.
 *
 * Mocks OrchestratorService.stream to yield a delta + done chunk so the SSE
 * writer (ack/text/done events) and the AI adapter complete() aggregation are
 * exercised without a real AI provider. SendMessageUseCase is driven for real
 * against in-memory repos.
 */

import type { AIStreamChunk } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const fakeStream = vi.hoisted(() => vi.fn());

vi.mock('../../orchestrator', () => ({
  OrchestratorService: class {
    stream = fakeStream;
  },
}));

const { fakeSessionRepo, fakeMessageRepo, fakeUsageRepo } = vi.hoisted(() => {
  const fakeSessionRepo = {
    findById: async () => null,
    save: async (s: unknown) => s,
    findByUserId: async () => [],
    delete: async () => undefined,
  };
  const fakeMessageRepo = {
    findBySessionId: async () => [],
    save: async () => undefined,
    deleteBySessionId: async () => undefined,
  };
  const fakeUsageRepo = { insert: async () => undefined };
  return { fakeSessionRepo, fakeMessageRepo, fakeUsageRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    chatSession: fakeSessionRepo,
    message: fakeMessageRepo,
    agent: { findById: async () => null },
    tokenUsage: fakeUsageRepo,
  }),
  getChatWorkDir: () => '/tmp/wolfkrow-chat-test',
  resolveAgentStreamPort: vi.fn(),
}));

vi.mock('../../memory/lifecycle', () => ({ recordChatTurn: vi.fn() }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { chatRoutes } from '../chat';

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

async function collectSse(res: { body: unknown }): Promise<string> {
  const body = res.body;
  if (Buffer.isBuffer(body)) return body.toString();
  let raw = '';
  for await (const chunk of body as NodeJS.ReadableStream) raw += chunk.toString();
  return raw;
}

describe('chat POST /send — SSE stream', () => {
  it('streams ack → text → done for a successful turn', async () => {
    const chunks: AIStreamChunk[] = [
      { delta: 'Hello ' },
      { delta: 'world' },
      { delta: '', done: true, inputTokens: 5, outputTokens: 2 },
    ];
    fakeStream.mockImplementation(async function* () {
      for (const c of chunks) yield c;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/send',
      headers: BEARER,
      payload: { message: 'hi' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const raw = await collectSse(res);
    // The SSE frames include the ack, both text deltas, and the done event.
    expect(raw).toContain('"type":"ack"');
    expect(raw).toContain('"type":"text"');
    expect(raw).toContain('Hello ');
    expect(raw).toContain('world');
    expect(raw).toContain('"type":"done"');
  }, 10000);

  it('emits an error SSE event when the orchestrator stream throws', async () => {
    fakeStream.mockImplementation(() => ({
      [Symbol.asyncIterator]() {
        return { next: () => Promise.reject(new Error('upstream failure')) };
      },
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/send',
      headers: BEARER,
      payload: { message: 'boom' },
    });
    expect(res.statusCode).toBe(200);
    const raw = await collectSse(res);
    expect(raw).toContain('"type":"error"');
    expect(raw).toContain('upstream failure');
  }, 10000);
});

// ---- writeStreamAsSse chunk-type branches (toolCall/toolResult/toolPermission) ----
describe('chat POST /send — SSE chunk-type branches', () => {
  it('emits tool_call and tool_result events', async () => {
    fakeStream.mockImplementation(async function* () {
      yield { toolCall: { id: 'tc-1', name: 'Bash:ls', input: { cmd: 'ls' } } };
      yield { toolResult: { callId: 'tc-1', output: 'file.txt', isError: false } };
      yield { done: true };
    });
    const res = await app.inject({
      method: 'POST',
      url: '/send',
      headers: BEARER,
      payload: { message: 'run ls' },
    });
    expect(res.statusCode).toBe(200);
    const raw = await collectSse(res);
    expect(raw).toContain('"type":"tool_call"');
    expect(raw).toContain('"name":"Bash:ls"');
    expect(raw).toContain('"type":"tool_result"');
    expect(raw).toContain('file.txt');
  }, 10000);

  it('emits a tool_permission event for a destructive tool surface', async () => {
    fakeStream.mockImplementation(async function* () {
      yield { toolPermission: { callId: 'tp-1', name: 'Bash:rm', input: {}, prompt: 'Allow rm?' } };
      yield { done: true };
    });
    const res = await app.inject({
      method: 'POST',
      url: '/send',
      headers: BEARER,
      payload: { message: 'rm' },
    });
    expect(res.statusCode).toBe(200);
    const raw = await collectSse(res);
    expect(raw).toContain('"type":"tool_permission"');
    expect(raw).toContain('"id":"tp-1"');
    expect(raw).toContain('Allow rm?');
  }, 10000);
});
