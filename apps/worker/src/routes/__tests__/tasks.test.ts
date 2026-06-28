/**
 * Tasks CRUD routes — happy / error / auth paths.
 *
 * tasks.ts calls getRepos().task directly (no use-case layer), so mocking the
 * task repo with an in-memory fake exercises the real route logic (query
 * parsing, mapTaskPatch, 404 on missing update). Auth uses the real-behaving
 * decorator so the 401-without-session case is a genuine rejection.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

interface StoredTask {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  category: 'work' | 'personal' | 'learning' | 'health' | 'finance' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
  completedAt: Date | null;
}

const tasks = new Map<string, StoredTask>();
let seq = 0;

const fakeTaskRepo = {
  findMany: vi.fn((opts: { userId: string; status?: string; category?: string }) =>
    [...tasks.values()].filter(
      (t) =>
        t.userId === opts.userId &&
        (!opts.status || t.status === opts.status) &&
        (!opts.category || t.category === opts.category)
    )
  ),
  create: vi.fn((input: Partial<StoredTask> & { userId: string; title: string }) => {
    const task: StoredTask = {
      id: `t${++seq}`,
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'todo',
      category: input.category ?? 'personal',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      tags: input.tags ?? [],
      createdAt: new Date(),
      completedAt: null,
    };
    tasks.set(task.id, task);
    return task;
  }),
  update: vi.fn((id: string, patch: Partial<StoredTask>) => {
    const existing = tasks.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id };
    tasks.set(id, updated);
    return updated;
  }),
  delete: vi.fn((id: string) => {
    tasks.delete(id);
  }),
};

vi.mock('../../container', () => ({ getRepos: () => ({ task: fakeTaskRepo }) }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { tasksRoutes } from '../tasks';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  tasks.clear();
  seq = 0;
  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await tasksRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('tasks POST / — create', () => {
  it('creates a task with defaults and returns 201', async () => {
    fakeTaskRepo.create.mockClear();
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { title: 'Write tests' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { task: StoredTask };
    expect(body.task.title).toBe('Write tests');
    expect(body.task.status).toBe('todo');
    expect(body.task.priority).toBe('medium');
    // The repo was called with userId derived from the auth decorator.
    expect(fakeTaskRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('accepts all optional fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        title: 'Ship',
        description: 'go live',
        status: 'in_progress',
        category: 'work',
        priority: 'urgent',
        dueDate: '2026-07-01T00:00:00.000Z',
        tags: ['release'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { task: StoredTask };
    expect(body.task.category).toBe('work');
    expect(body.task.dueDate).not.toBeNull();
    expect(body.task.tags).toEqual(['release']);
  });

  it('rejects a body missing title → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid status enum → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { title: 'x', status: 'bogus' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('tasks GET / — list with filters', () => {
  it('returns all tasks for the user when no filters', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { tasks: StoredTask[] };
    expect(body.tasks.length).toBeGreaterThanOrEqual(2);
    expect(fakeTaskRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('passes status + category filters to the repo', async () => {
    fakeTaskRepo.findMany.mockClear();
    await app.inject({ method: 'GET', url: '/?status=in_progress&category=work' });
    expect(fakeTaskRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress', category: 'work' })
    );
  });
});

describe('tasks PATCH /:id — update', () => {
  it('updates a task and returns it', async () => {
    const existing = [...tasks.values()][0]!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/${existing.id}`,
      payload: { status: 'done', priority: 'low' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { task: StoredTask };
    expect(body.task.status).toBe('done');
    expect(body.task.priority).toBe('low');
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/missing',
      payload: { title: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('tasks DELETE /:id', () => {
  it('deletes a task and returns ok', async () => {
    const target = [...tasks.values()].find((t) => t.title === 'Ship')!;
    const res = await app.inject({ method: 'DELETE', url: `/${target.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(tasks.has(target.id)).toBe(false);
  });
});

// ---- Authentication is enforced: anonymous callers get 401, never the
// 'default' user (default-user leak class of P0-7/P2-1). Uses the real-behaving
// authenticate decorator so the rejection is genuine. ----
describe('tasks routes — authentication required (default-user leak fix)', () => {
  async function buildRealAuthApp(): Promise<FastifyInstance> {
    const a = Fastify();
    a.decorate('authenticate', realAuthenticate);
    setErrorHandler(a);
    await tasksRoutes(a as unknown as AuthFastifyInstance);
    await a.ready();
    return a;
  }

  it('GET / without credentials → 401', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('POST / without credentials → 401', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({ method: 'POST', url: '/', payload: { title: 'x' } });
    expect(res.statusCode).toBe(401);
    await a.close();
  });

  it('GET / WITH credentials → 200 (real user, not default)', async () => {
    const a = await buildRealAuthApp();
    const res = await a.inject({
      method: 'GET',
      url: '/',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.statusCode).toBe(200);
    await a.close();
  });
});
