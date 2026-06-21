/**
 * Tasks CRUD routes — S.4.
 */

import { randomUUID } from 'crypto';
import { and, eq, desc } from 'drizzle-orm';

import { getDb } from '@wolfkrow/infra/db/client';
import { tasks } from '@wolfkrow/infra/db/schema';

import type { AuthFastifyInstance } from '../types/fastify';

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
type TaskCategory = 'work' | 'personal' | 'learning' | 'health' | 'finance' | 'other';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TaskBody {
  title: string;
  description?: string;
  status?: TaskStatus;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
}

export async function tasksRoutes(server: AuthFastifyInstance) {
  const db = getDb();

  // GET /tasks?status=&category=
  server.get<{ Querystring: { status?: TaskStatus; category?: TaskCategory } }>(
    '/',
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const conds = [eq(tasks.userId, userId)];
      if (req.query.status) conds.push(eq(tasks.status, req.query.status));
      if (req.query.category) conds.push(eq(tasks.category, req.query.category));

      const rows = db.select().from(tasks).where(and(...conds)).orderBy(desc(tasks.createdAt)).all();
      return reply.send({ tasks: rows });
    },
  );

  // POST /tasks — create
  server.post<{ Body: TaskBody }>('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const now = new Date();
    const task = {
      id: randomUUID(),
      userId,
      title: req.body.title,
      description: req.body.description ?? null,
      status: (req.body.status ?? 'todo') as TaskStatus,
      category: (req.body.category ?? 'personal') as TaskCategory,
      priority: (req.body.priority ?? 'medium') as TaskPriority,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      completedAt: null,
      tags: req.body.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    db.insert(tasks).values(task).run();
    return reply.status(201).send({ task });
  });

  // PATCH /tasks/:id — update status/priority/title
  server.patch<{ Params: { id: string }; Body: Partial<TaskBody & { completedAt?: string }> }>(
    '/:id',
    async (req, reply) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.title !== undefined) patch['title'] = req.body.title;
      if (req.body.description !== undefined) patch['description'] = req.body.description ?? null;
      if (req.body.status !== undefined) {
        patch['status'] = req.body.status;
        if (req.body.status === 'done') patch['completedAt'] = new Date();
      }
      if (req.body.priority !== undefined) patch['priority'] = req.body.priority;
      if (req.body.category !== undefined) patch['category'] = req.body.category;
      if (req.body.dueDate !== undefined) patch['dueDate'] = req.body.dueDate ? new Date(req.body.dueDate) : null;
      if (req.body.tags !== undefined) patch['tags'] = req.body.tags;

      db.update(tasks).set(patch as never).where(eq(tasks.id, req.params.id)).run();
      const updated = db.select().from(tasks).where(eq(tasks.id, req.params.id)).get();
      return reply.send({ task: updated });
    },
  );

  // DELETE /tasks/:id
  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    db.delete(tasks).where(eq(tasks.id, req.params.id)).run();
    return reply.send({ ok: true });
  });
}
