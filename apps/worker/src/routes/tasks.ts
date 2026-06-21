/**
 * Tasks CRUD routes — S.4.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';

import { getDb } from '@wolfkrow/infra/db/client';
import { tasks } from '@wolfkrow/infra/db/schema';

import { validate } from '../validation';
import type { AuthFastifyInstance } from '../types/fastify';

const taskCreateBody = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).default('todo'),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).default('personal'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

const taskPatchBody = taskCreateBody.partial();

const taskQuerySchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).optional(),
});

type TaskStatus = z.infer<typeof taskCreateBody>['status'];
type TaskCategory = z.infer<typeof taskCreateBody>['category'];
type TaskPriority = z.infer<typeof taskCreateBody>['priority'];

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

export async function tasksRoutes(server: AuthFastifyInstance) {
  const db = getDb();

  // GET /tasks?status=&category=
  server.get<{ Querystring: { status?: string; category?: string } }>(
    '/',
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const { status, category } = validate(taskQuerySchema, req.query);
      const conds = [eq(tasks.userId, userId)];
      if (status) conds.push(eq(tasks.status, status as TaskStatus));
      if (category) conds.push(eq(tasks.category, category as TaskCategory));

      const rows = db.select().from(tasks).where(and(...conds)).orderBy(desc(tasks.createdAt)).all();
      return reply.send({ tasks: rows });
    },
  );

  // POST /tasks — create
  server.post<{ Body: unknown }>('/', async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const body = validate(taskCreateBody, req.body);
    const now = new Date();
    const task = {
      id: randomUUID(),
      userId,
      title: body.title,
      description: body.description ?? null,
      status: body.status as TaskStatus,
      category: body.category as TaskCategory,
      priority: body.priority as TaskPriority,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      completedAt: null,
      tags: body.tags,
      createdAt: now,
      updatedAt: now,
    };
    db.insert(tasks).values(task).run();
    return reply.status(201).send({ task });
  });

  // PATCH /tasks/:id — update
  server.patch<{ Params: { id: string }; Body: unknown }>(
    '/:id',
    async (req, reply) => {
      const body = validate(taskPatchBody, req.body);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) patch['title'] = body.title;
      if (body.description !== undefined) patch['description'] = body.description ?? null;
      if (body.status !== undefined) {
        patch['status'] = body.status;
        if (body.status === 'done') patch['completedAt'] = new Date();
      }
      if (body.priority !== undefined) patch['priority'] = body.priority;
      if (body.category !== undefined) patch['category'] = body.category;
      if (body.dueDate !== undefined) patch['dueDate'] = body.dueDate ? new Date(body.dueDate) : null;
      if (body.tags !== undefined) patch['tags'] = body.tags;

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
