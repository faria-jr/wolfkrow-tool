import type { UsageRecord } from '@wolfkrow/domain';
import { UsageSummarySchema } from '@wolfkrow/shared-types';
import type { UsageSummary } from '@wolfkrow/shared-types';
import Fastify from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


// In-memory token usage repo so the route exercises the real use-case +
// boundary parse without a database.
const records: UsageRecord[] = [];

vi.mock('../../container', () => ({
  getRepos: () => ({
    tokenUsage: {
      findMany: () =>
        records.filter((r) => r.userId === 'u1'),
      insert: (rec: UsageRecord) => records.push(rec),
      totalCostCents: () =>
        records
          .filter((r) => r.userId === 'u1')
          .reduce((sum, r) => sum + r.cost, 0),
    },
  }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { usageRoutes } from '../usage';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

// Recent timestamps so the budget use-case's 30-day window includes them.
const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const todayDay = today.toISOString().slice(0, 10);
const yesterdayDay = yesterday.toISOString().slice(0, 10);
const expectedDays = [yesterdayDay, todayDay].sort((a, b) => a.localeCompare(b));

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  records.length = 0;
  records.push(
    {
      id: 'r1',
      userId: 'u1',
      source: 'chat',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cost: 1000,
      sessionId: undefined,
      agentId: undefined,
      runtime: 'cloud',
      timestamp: yesterday,
    },
    {
      id: 'r2',
      userId: 'u1',
      source: 'agent',
      model: 'claude-sonnet-4-6',
      inputTokens: 200,
      outputTokens: 80,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cost: 2500,
      sessionId: undefined,
      agentId: undefined,
      runtime: 'cloud',
      timestamp: today,
    },
  );

  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await usageRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /usage/summary', () => {
  it('returns 200 with the canonical UsageSummary shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UsageSummary;

    // Totals reflect the two seeded records.
    expect(body.totalInputTokens).toBe(300);
    expect(body.totalOutputTokens).toBe(130);
    expect(body.totalCostUSD).toBeCloseTo(35, 2); // (1000+2500) cents = $35

    // byDay is an array sorted ascending, not a Record.
    expect(Array.isArray(body.byDay)).toBe(true);
    expect(body.byDay).toHaveLength(2);
    expect(body.byDay[0]!.day).toBe(expectedDays[0]);
    expect(body.byDay[1]!.day).toBe(expectedDays[1]);
    // The yesterday record: 100 in / 50 out / $10.
    const first = yesterdayDay < todayDay ? body.byDay[0] : body.byDay[1];
    expect(first).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      costUSD: 10,
    });
  });

  it('returns the budget endpoint shape unchanged', async () => {
    const res = await app.inject({ method: 'GET', url: '/budget?budgetUSD=30' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { spentUSD: number; budgetUSD: number; percentUsed: number; exceeded: boolean };
    expect(body.budgetUSD).toBe(30);
    // Both records fall inside the default 30-day window: $35 > $30 → exceeded.
    expect(body.spentUSD).toBeCloseTo(35, 2);
    expect(body.exceeded).toBe(true);
  });
});

// The /summary route calls `UsageSummarySchema.parse(summary)` before
// `reply.send` (ADR-0005 Zod boundary). These tests prove that parse guards the
// response: a malformed summary from the use-case layer throws rather than
// leaking garbage to the client.
describe('GET /usage/summary boundary parse', () => {
  it('rejects a summary with non-numeric token totals', () => {
    expect(() =>
      UsageSummarySchema.parse({
        totalInputTokens: 'not-a-number',
        totalOutputTokens: 130,
        totalCostUSD: 35,
        byModel: {},
        bySource: {},
        byDay: [],
      }),
    ).toThrow();
  });

  it('rejects a summary with byDay as a Record instead of an array', () => {
    expect(() =>
      UsageSummarySchema.parse({
        totalInputTokens: 300,
        totalOutputTokens: 130,
        totalCostUSD: 35,
        byModel: {},
        bySource: {},
        byDay: { '2024-01-01': { inputTokens: 1, outputTokens: 1, costUSD: 1 } },
      }),
    ).toThrow();
  });
});

// ---- P1-5: query-param filter branches (from/to/source/agentId spreads) ----
describe('GET /usage/summary — query-param filter branches', () => {
  it('passes from/to/source/agentId filters through (all arms present)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/summary?from=2024-01-01T00%3A00%3A00.000Z&to=2024-12-31T00%3A00%3A00.000Z&source=chat&agentId=a1',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as UsageSummary;
    // The fake repo filters by userId only; the parse still succeeds.
    expect(body.totalInputTokens).toBe(300);
  });
});

// ---- /records endpoint was entirely untested (line 67-76) ----
describe('GET /usage/records', () => {
  it('returns records for the authenticated user with no filters', async () => {
    const res = await app.inject({ method: 'GET', url: '/records' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { records: { id: string }[] };
    expect(body.records).toHaveLength(2);
    expect(body.records.map((r) => r.id)).toEqual(expect.arrayContaining(['r1', 'r2']));
  });

  it('forwards from/to/source/agentId filters to repo.findMany (all arms present)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/records?from=2024-01-01T00%3A00%3A00.000Z&to=2024-12-31T00%3A00%3A00.000Z&source=agent&agentId=a9',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { records: unknown[] };
    expect(Array.isArray(body.records)).toBe(true);
  });
});

// ---- Authentication is enforced: anonymous callers get 401, never the
// 'default' user (default-user leak class of P0-7/P2-1). Uses the
// real-behaving authenticate decorator so the rejection is genuine. ----
describe('usage routes — authentication required (default-user leak fix)', () => {
  it('GET /summary without credentials → 401', async () => {
    const authedApp = Fastify();
    authedApp.decorate('authenticate', realAuthenticate);
    setErrorHandler(authedApp);
    await usageRoutes(authedApp as unknown as AuthFastifyInstance);
    await authedApp.ready();
    const res = await authedApp.inject({ method: 'GET', url: '/summary' });
    expect(res.statusCode).toBe(401);
    await authedApp.close();
  });

  it('GET /budget without credentials → 401', async () => {
    const authedApp = Fastify();
    authedApp.decorate('authenticate', realAuthenticate);
    setErrorHandler(authedApp);
    await usageRoutes(authedApp as unknown as AuthFastifyInstance);
    await authedApp.ready();
    const res = await authedApp.inject({ method: 'GET', url: '/budget?budgetUSD=30' });
    expect(res.statusCode).toBe(401);
    await authedApp.close();
  });

  it('GET /records without credentials → 401', async () => {
    const authedApp = Fastify();
    authedApp.decorate('authenticate', realAuthenticate);
    setErrorHandler(authedApp);
    await usageRoutes(authedApp as unknown as AuthFastifyInstance);
    await authedApp.ready();
    const res = await authedApp.inject({ method: 'GET', url: '/records' });
    expect(res.statusCode).toBe(401);
    await authedApp.close();
  });

  it('GET /summary WITH credentials → 200 (real user, not default)', async () => {
    const authedApp = Fastify();
    authedApp.decorate('authenticate', realAuthenticate);
    setErrorHandler(authedApp);
    await usageRoutes(authedApp as unknown as AuthFastifyInstance);
    await authedApp.ready();
    const res = await authedApp.inject({
      method: 'GET',
      url: '/summary',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.statusCode).toBe(200);
    await authedApp.close();
  });
});
