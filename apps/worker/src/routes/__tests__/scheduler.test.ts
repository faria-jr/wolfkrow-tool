/**
 * Scheduler routes — happy / error / auth paths.
 *
 * scheduler.ts builds use-cases per-request from getRepos().scheduledTask +
 * .taskRun, and createAgentExecutor for the /run endpoint. Mocking the repos
 * with in-memory fakes (backed by real ScheduledTask/TaskRun entities) and
 * stubbing createAgentExecutor exercises the real route logic. Auth is via
 * preHandler (real-behaving decorator) so 401-without-session is genuine.
 */

import { ScheduledTask, TaskRun } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


const { tasks, runs, fakeScheduledTaskRepo, fakeTaskRunRepo } = vi.hoisted(() => {
  const tasks = new Map<string, ScheduledTask>();
  const runs = new Map<string, TaskRun>();

  const fakeScheduledTaskRepo = {
    findById: async (id: string) => tasks.get(id) ?? null,
    findByUserId: async (userId: string) => [...tasks.values()].filter((t) => t.userId === userId),
    findEnabledDueBy: async () => [] as ScheduledTask[],
    save: async (t: ScheduledTask) => {
      tasks.set(t.id, t);
      return t;
    },
    delete: async (id: string) => {
      tasks.delete(id);
    },
  };

  const fakeTaskRunRepo = {
    findById: async (id: string) => runs.get(id) ?? null,
    findByTaskId: async (taskId: string, _limit?: number) =>
      [...runs.values()].filter((r) => (r as unknown as { taskId: string }).taskId === taskId),
    findAwaitingReview: async (userId: string) =>
      [...runs.values()].filter((r) => (r as unknown as { userId: string }).userId === userId),
    save: async (r: TaskRun) => {
      runs.set(r.id, r);
      return r;
    },
  };
  return { tasks, runs, fakeScheduledTaskRepo, fakeTaskRunRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({ scheduledTask: fakeScheduledTaskRepo, taskRun: fakeTaskRunRepo }),
}));

vi.mock('../../agent-executor', () => ({
  createAgentExecutor: () => ({
    // The /run endpoint calls executor.execute which must produce a run result.
    execute: async () => ({ status: 'completed', output: 'ran', tokensUsed: 10 }),
  }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { schedulerRoutes } from '../scheduler';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  tasks.clear();
  runs.clear();
  // Seed one enabled task for list/patch/run paths.
  const seeded = ScheduledTask.create({
    userId: 'u1',
    name: 'Daily digest',
    cronExpression: '0 9 * * *',
    prompt: 'Summarize my day',
    timezone: 'America/Sao_Paulo',
    enabled: true,
    config: {},
    tags: [],
    description: undefined,
    agentId: undefined,
    lastRunAt: undefined,
    nextRunAt: undefined,
  });
  tasks.set(seeded.id, seeded);

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await schedulerRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('scheduler routes — authentication', () => {
  it('GET /tasks without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks' });
    expect(res.statusCode).toBe(401);
  });
});

describe('scheduler GET /tasks — list', () => {
  it('returns the seeded task with a count', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tasks: { name: string }[]; count: number };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.tasks.some((t) => t.name === 'Daily digest')).toBe(true);
  });
});

describe('scheduler POST /tasks — create', () => {
  it('creates a scheduled task and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: BEARER,
      payload: { name: 'Weekly review', cronExpression: '0 10 * * 1', prompt: 'Review the week' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { task: { name: string; cronExpression: string } };
    expect(body.task.name).toBe('Weekly review');
    expect(body.task.cronExpression).toBe('0 10 * * 1');
  });

  it('rejects a body missing required fields → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/tasks', headers: BEARER, payload: { name: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('accepts all optional fields (description, agentId, tags)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/tasks', headers: BEARER,
      payload: {
        name: 'Full task', cronExpression: '0 0 * * *', prompt: 'p',
        description: 'd', agentId: 'agent-1', tags: ['ops'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { task: { tags: string[] } };
    expect(body.task.tags).toEqual(['ops']);
  });
});

describe('scheduler PATCH /tasks/:id — update', () => {
  it('updates name/enabled and returns the task', async () => {
    const existing = [...tasks.values()].find((t) => t.name === 'Daily digest')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${existing.id}`,
      headers: BEARER,
      payload: { name: 'Daily summary', enabled: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { task: { name: string; enabled: boolean } };
    expect(body.task.name).toBe('Daily summary');
    expect(body.task.enabled).toBe(false);
  });

  it('updates all optional fields (description, cron, prompt, tags)', async () => {
    const existing = [...tasks.values()].find((t) => t.name === 'Full task')!;
    const res = await app.inject({
      method: 'PATCH', url: `/tasks/${existing.id}`, headers: BEARER,
      payload: {
        name: 'Renamed', description: 'new desc', cronExpression: '0 12 * * *',
        prompt: 'new prompt', enabled: true, tags: ['x'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { task: { prompt: string; tags: string[] } };
    expect(body.task.prompt).toBe('new prompt');
    expect(body.task.tags).toEqual(['x']);
  });
});

describe('scheduler DELETE /tasks/:id', () => {
  it('deletes a task and returns ok', async () => {
    const existing = [...tasks.values()].find((t) => t.name === 'Weekly review')!;
    const res = await app.inject({ method: 'DELETE', url: `/tasks/${existing.id}`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
    expect(tasks.has(existing.id)).toBe(false);
  });
});

describe('scheduler POST /tasks/:id/run', () => {
  it('triggers a run and returns 202 with a run', async () => {
    const existing = [...tasks.values()].find((t) => t.name === 'Daily summary')!;
    const res = await app.inject({ method: 'POST', url: `/tasks/${existing.id}/run`, headers: BEARER });
    expect(res.statusCode).toBe(202);
    const body = res.json() as { run: { status: string } };
    expect(body.run).toBeDefined();
  });
});

describe('scheduler GET /tasks/:id/runs + pending-review + review', () => {
  it('lists runs for a task', async () => {
    const existing = [...tasks.values()].find((t) => t.name === 'Daily summary')!;
    const res = await app.inject({ method: 'GET', url: `/tasks/${existing.id}/runs`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { runs: unknown[] };
    expect(Array.isArray(body.runs)).toBe(true);
  });

  it('lists runs awaiting review', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs/pending-review', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { runs: unknown[]; count: number };
    expect(typeof body.count).toBe('number');
  });

  it('reviews a run with verdict validated', async () => {
    // Seed a run in awaiting_review to review.
    const run = TaskRun.create({
      taskId: 'some-task',
      userId: 'u1',
      prompt: 'p',
      status: 'awaiting_review',
      startedAt: new Date(),
      completedAt: undefined,
      reviewedAt: undefined,
      result: { status: 'completed', output: 'done' },
      error: undefined,
    } as never);
    runs.set(run.id, run);

    const res = await app.inject({
      method: 'POST',
      url: `/runs/${run.id}/review`,
      headers: BEARER,
      payload: { verdict: 'validated', note: 'looks good' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { run: { status: string } };
    expect(body.run).toBeDefined();
  });

  it('rejects an invalid verdict → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/runs/whatever/review', headers: BEARER, payload: { verdict: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('reviews a run with verdict rejected + note (covers note branch)', async () => {
    const run = TaskRun.create({
      taskId: 'some-task', userId: 'u1', prompt: 'p', status: 'awaiting_review',
      startedAt: new Date(), completedAt: undefined, reviewedAt: undefined,
      result: { status: 'completed', output: 'done' }, error: undefined,
    } as never);
    runs.set(run.id, run);
    const res = await app.inject({
      method: 'POST', url: `/runs/${run.id}/review`, headers: BEARER,
      payload: { verdict: 'rejected', note: 'bad output' },
    });
    expect(res.statusCode).toBe(200);
  });
});
