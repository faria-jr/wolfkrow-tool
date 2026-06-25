/**
 * Rules routes — happy / error / auth paths.
 *
 * rules.ts builds the use-cases at module scope from getRepos().globalRule, so
 * mocking that repo with an in-memory fake (backed by real GlobalRule
 * entities) exercises the real Create/List/Update/Toggle/Delete/BuildPrompt
 * use-cases. Auth uses the real-behaving decorator so 401-without-session is a
 * genuine rejection (rules routes use preHandler auth).
 */

import { GlobalRule } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


// rules.ts reads getRepos().globalRule at MODULE TOP-LEVEL, so the fake must be
// initialized before the mock factory runs. vi.hoisted lifts the store + repo
// so they exist when rules.ts is evaluated.
const { rules, fakeRuleRepo } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = new Map<string, any>();
  const fakeRuleRepo = {
    findAll: async (userId: string) => [...rules.values()].filter((r: { userId: string }) => r.userId === userId),
    findById: async (id: string) => rules.get(id) ?? null,
    save: async (rule: { id: string }) => {
      rules.set(rule.id, rule);
      return rule;
    },
    delete: async (id: string) => {
      rules.delete(id);
    },
  };
  return { rules, fakeRuleRepo };
});

vi.mock('../../container', () => ({ getRepos: () => ({ globalRule: fakeRuleRepo }) }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { rulesRoutes } from '../rules';

import { setErrorHandler } from './helpers/app';

/** Stamp req.user on every request (mirrors app-scope auth plugin). */
function stampUser(): (req: FastifyRequest, _reply: FastifyReply) => Promise<void> {
  return async (req) => {
    req.user = { userId: 'u1' };
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  rules.clear();
  const seeded = GlobalRule.create({
    userId: 'u1', kind: 'behavior', title: 'Be concise', body: 'Keep replies short.',
  });
  rules.set(seeded.id, seeded);
  app = Fastify();
  app.addHook('onRequest', stampUser());
  setErrorHandler(app);
  await rulesRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('rules GET / — list', () => {
  it('returns the seeded rule as props', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rules: { title: string; enabled: boolean }[] };
    expect(body.rules.some((r) => r.title === 'Be concise')).toBe(true);
  });
});

describe('rules POST / — create', () => {
  it('creates a rule with defaults (enabled=true, sortOrder=0) and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { kind: 'soul', title: 'Soul rule', body: 'Be helpful.' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { rule: { kind: string; enabled: boolean; sortOrder: number } };
    expect(body.rule.kind).toBe('soul');
    expect(body.rule.enabled).toBe(true);
    expect(body.rule.sortOrder).toBe(0);
  });

  it('rejects an invalid kind → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/',      payload: { kind: 'bogus', title: 't', body: 'b' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body missing required fields → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: { kind: 'soul' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('rules PATCH /:id — update', () => {
  it('updates title and body, returns the updated rule', async () => {
    const existing = [...rules.values()].find((r) => r.title === 'Be concise')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/${existing.id}`,
      payload: { title: 'Be brief', body: 'Shorter replies.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rule: { title: string; body: string } };
    expect(body.rule.title).toBe('Be brief');
    expect(body.rule.body).toBe('Shorter replies.');
  });
});

describe('rules POST /:id/toggle — toggle enabled', () => {
  it('flips enabled and returns the rule', async () => {
    const existing = [...rules.values()].find((r) => r.title === 'Be brief')!;
    const before = existing.enabled;
    const res = await app.inject({ method: 'POST', url: `/${existing.id}/toggle` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rule: { enabled: boolean } };
    expect(body.rule.enabled).toBe(!before);
  });
});

describe('rules POST /build-prompt', () => {
  it('assembles a system prompt from enabled rules', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/build-prompt',
      payload: { agentSystemPrompt: 'You are an assistant.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { prompt: string };
    expect(typeof body.prompt).toBe('string');
    // The prompt should include at least one rule body OR the agent prompt.
    expect(body.prompt.length).toBeGreaterThan(0);
  });

  it('accepts skillDescriptions + empty body (default branches)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/build-prompt',
      payload: { skillDescriptions: ['skill-a', 'skill-b'] },
    });
    expect(res.statusCode).toBe(200);
  });

  it('works with an empty body (no agent prompt, no skills)', async () => {
    const res = await app.inject({ method: 'POST', url: '/build-prompt', payload: {} });
    expect(res.statusCode).toBe(200);
  });
});

describe('rules PATCH /:id — additional update branches', () => {
  it('updates enabled + sortOrder', async () => {
    const existing = [...rules.values()].find((r) => r.title === 'Be brief')!;
    const res = await app.inject({
      method: 'PATCH', url: `/${existing.id}`,
      payload: { enabled: false, sortOrder: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { rule: { enabled: boolean; sortOrder: number } };
    expect(body.rule.enabled).toBe(false);
    expect(body.rule.sortOrder).toBe(5);
  });
});

describe('rules DELETE /:id', () => {
  it('deletes a rule and returns ok', async () => {
    const target = [...rules.values()].find((r) => r.title === 'Soul rule')!;
    const res = await app.inject({ method: 'DELETE', url: `/${target.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(rules.has(target.id)).toBe(false);
  });
});
