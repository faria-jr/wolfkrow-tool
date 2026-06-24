/**
 * P1-1b — web boundary validation tests.
 *
 * Two layers:
 *  1. Schema matrix — every new request schema rejects an invalid body and
 *     accepts a valid one (proves the Zod contract per route).
 *  2. Route integration — POST /api/auth/setup with an invalid body returns 400
 *     with the VALIDATION_ERROR code (proves validateBody is wired into the
 *     handler and that validation runs before any use-case/auth logic).
 *
 * Auth-sensitive routes (setup/unlock/totp*) are covered by the schema matrix
 * only; their auth logic is intentionally not exercised here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AgentSyncRequestBodySchema,
  CreateAgentRequestBodySchema,
  CreateMemoryRequestBodySchema,
  CreateMcpServerRequestBodySchema,
  CreateScheduledTaskRequestBodySchema,
  CreateSkillRequestBodySchema,
  DisableTotpRequestBodySchema,
  DuplicateAgentRequestBodySchema,
  EnableTotpRequestBodySchema,
  MemorySearchRequestBodySchema,
  ReviewTaskRunRequestBodySchema,
  SearchQuerySchema,
  SetupRequestBodySchema,
  UnlockRequestBodySchema,
  UpdateAgentInputSchema,
  UpdateMcpServerRequestBodySchema,
  UpdateSkillRequestBodySchema,
  VerifyTotpRequestBodySchema,
} from '@wolfkrow/shared-types';

import { validateBody } from '../validation';

/**
 * Assert that `validateBody` returns a 400 Response for `bad` and the parsed
 * value for `good`.
 */
function expectRejectsAndAccepts<T>(
  schema: import('zod').ZodType<T>,
  bad: unknown,
  good: unknown,
): void {
  const badResult = validateBody(schema, bad);
  expect(badResult).toBeInstanceOf(Response);
  if (badResult instanceof Response) {
    expect(badResult.status).toBe(400);
  }

  const goodResult = validateBody(schema, good);
  expect(goodResult).not.toBeInstanceOf(Response);
}

describe('P1-1b request schema boundary matrix', () => {
  it('auth setup: rejects missing password, accepts valid body', () => {
    expectRejectsAndAccepts(SetupRequestBodySchema, { displayName: 'x' }, { password: 'secret1' });
  });

  it('auth setup: rejects mismatched confirmPassword', () => {
    const res = validateBody(SetupRequestBodySchema, { password: 'secret1', confirmPassword: 'nope' });
    expect(res).toBeInstanceOf(Response);
    if (res instanceof Response) expect(res.status).toBe(400);
  });

  it('auth unlock + verify-totp + enable/disable-totp: reject empty, accept valid', () => {
    expectRejectsAndAccepts(UnlockRequestBodySchema, {}, { password: 'secret1' });
    expectRejectsAndAccepts(
      VerifyTotpRequestBodySchema,
      { userId: 'not-a-uuid', code: '123456' },
      { userId: '550e8400-e29b-41d4-a716-446655440000', code: '123456' },
    );
    expectRejectsAndAccepts(
      EnableTotpRequestBodySchema,
      { secret: 's' },
      { secret: 'BASE32SECRET', code: '123456' },
    );
    expectRejectsAndAccepts(
      DisableTotpRequestBodySchema,
      {},
      { password: 'secret1', code: '123456' },
    );
  });

  it('agents: create/duplicate/sync/update reject invalid, accept valid', () => {
    expectRejectsAndAccepts(CreateAgentRequestBodySchema, {}, { name: 'Agent' });
    expectRejectsAndAccepts(DuplicateAgentRequestBodySchema, {}, { newName: 'Copy' });
    expectRejectsAndAccepts(
      AgentSyncRequestBodySchema,
      { targetRuntime: 'bogus' },
      { targetRuntime: 'cloud' },
    );
    expectRejectsAndAccepts(UpdateAgentInputSchema, { name: 123 }, { name: 'Updated' });
  });

  it('memory: create/search reject invalid, accept valid', () => {
    expectRejectsAndAccepts(CreateMemoryRequestBodySchema, {}, { content: 'a memory' });
    expectRejectsAndAccepts(MemorySearchRequestBodySchema, {}, { query: 'q' });
  });

  it('knowledge search: rejects missing query, accepts valid', () => {
    expectRejectsAndAccepts(SearchQuerySchema, {}, { query: 'hello' });
  });

  it('mcp servers: create/update reject invalid, accept valid', () => {
    expectRejectsAndAccepts(
      CreateMcpServerRequestBodySchema,
      { name: 'x' },
      { name: 'srv', command: 'run' },
    );
    expectRejectsAndAccepts(
      UpdateMcpServerRequestBodySchema,
      {},
      { isActive: true },
    );
  });

  it('scheduler: task create/run-review/update reject invalid, accept valid', () => {
    expectRejectsAndAccepts(
      CreateScheduledTaskRequestBodySchema,
      { name: 't' },
      { name: 't', cronExpression: '0 * * * *', prompt: 'go' },
    );
    expectRejectsAndAccepts(
      ReviewTaskRunRequestBodySchema,
      { verdict: 'maybe' },
      { verdict: 'validated' },
    );
  });

  it('skills: create/update reject invalid, accept valid', () => {
    expectRejectsAndAccepts(
      CreateSkillRequestBodySchema,
      { tags: 'not-array' },
      { name: 's', description: 'd', content: 'c' },
    );
    expectRejectsAndAccepts(UpdateSkillRequestBodySchema, { name: 1 }, { name: 's' });
  });
});

// ---------------------------------------------------------------------------
// Route integration: POST /api/auth/setup — proves validateBody is wired in
// the handler and runs before the use-case. setup needs no session cookie.
// ---------------------------------------------------------------------------

vi.mock('@/lib/container', () => ({
  getRepos: () => ({ user: {} }),
  getAdapters: () => ({ hasher: {} }),
}));

import { POST as setupPost } from '../../app/api/auth/setup/route';

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/setup — 400 on invalid body', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 400 VALIDATION_ERROR when password is missing', async () => {
    const res = await setupPost(jsonRequest({ displayName: 'owner' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when body is not an object', async () => {
    const res = await setupPost(jsonRequest(null));
    expect(res.status).toBe(400);
  });
});
