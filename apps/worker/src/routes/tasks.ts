/**
 * Tasks CRUD routes — S.4.  */

import { z } from 'zod';

import { getRepos } from '../container';
import { fromQuery, paginateArray } from '../lib/paginate';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

const taskCreateBody = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).default('todo'),
  category: z
    .enum(['work', 'personal', 'learning', 'health', 'finance', 'other'])
    .default('personal'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

const taskPatchBody = taskCreateBody.partial();

const taskQuerySchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).optional(),
});

function getUserId(req: { user?: { userId?: string } }): string {
  return req.user?.userId ?? 'default';
}

function mapTaskPatch(body: z.infer<typeof taskPatchBody>) {
  return {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.priority !== undefined ? { priority: body.priority } : {}),
    ...(body.category !== undefined ? { category: body.category } : {}),
    ...(body.dueDate !== undefined
      ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
      : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
  };
}

export async function tasksRoutes(server: AuthFastifyInstance) {
  // Tasks are user-scoped (getUserId resolves the owner from req.user). Without
  // authentication every request maps to the shared 'default' user, so all
  // browser users would share one task list (the default-user leak class of
  // P0-7/P2-1). Authenticate every route in this plugin.
  const auth = { onRequest: [server.authenticate] };

  // GET /tasks?status=&category=
  server.get<{ Querystring: { status?: string; category?: string } }>(
    '/',
    auth,
    async (req, reply) => {
      const userId = getUserId(req as { user?: { userId?: string } });
      const { status, category } = validate(taskQuerySchema, req.query);
      const tasksList = getRepos().task.findMany({
        userId,
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      });
      return reply.send(paginateArray(fromQuery(req.query), tasksList, 'tasks'));
    }
  );

  // POST /tasks — create
  server.post<{ Body: unknown }>('/', auth, async (req, reply) => {
    const userId = getUserId(req as { user?: { userId?: string } });
    const body = validate(taskCreateBody, req.body);
    const task = getRepos().task.create({
      userId,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      status: body.status,
      category: body.category,
      priority: body.priority,
      ...(body.dueDate !== undefined ? { dueDate: new Date(body.dueDate) } : {}),
      tags: body.tags,
    });
    return reply.status(201).send({ task });
  });

  // PATCH /tasks/:id — update (completedAt derived from status in the repo)
  server.patch<{ Params: { id: string }; Body: unknown }>('/:id', auth, async (req, reply) => {
    const body = validate(taskPatchBody, req.body);
    const updated = getRepos().task.update(req.params.id, mapTaskPatch(body));
    if (!updated) return reply.status(404).send({ error: 'Task not found' });
    return reply.send({ task: updated });
  });

  // DELETE /tasks/:id
  server.delete<{ Params: { id: string } }>('/:id', auth, async (req, reply) => {
    getRepos().task.delete(req.params.id);
    return reply.send({ ok: true });
  });
}
