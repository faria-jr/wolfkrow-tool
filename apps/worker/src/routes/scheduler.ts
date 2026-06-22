/**
 * Scheduler routes — CRUD tasks, manual trigger, run history.
 * N.6: RunScheduledTaskUseCase encapsulates AI execution.
 */

import {
  CreateScheduledTaskUseCase,
  DeleteScheduledTaskUseCase,
  ListScheduledTasksUseCase,
  ReviewTaskRunUseCase,
  RunScheduledTaskUseCase,
  UpdateScheduledTaskUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { createAgentExecutor } from '../agent-executor';
import { getRepos } from '../container';
import type { Logger } from '../logger';
import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  const r = getRepos();
  return { taskRepo: r.scheduledTask, runRepo: r.taskRun };
}

interface CreateBody {
  name: string;
  description?: string;
  cronExpression: string;
  prompt: string;
  agentId?: string;
  tags?: string[];
}

interface UpdateBody {
  name?: string;
  description?: string;
  cronExpression?: string;
  prompt?: string;
  enabled?: boolean;
  tags?: string[];
}

async function createTaskHandler(req: FastifyRequest<{ Body: CreateBody }>, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = req.body;
  if (!body?.name || !body.cronExpression || !body.prompt) {
    return reply.code(400).send({ error: 'name, cronExpression and prompt required' });
  }
  const { taskRepo } = makeRepos();
  const result = await new CreateScheduledTaskUseCase(taskRepo).execute({
    userId,
    name: body.name,
    cronExpression: body.cronExpression,
    prompt: body.prompt,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
  });
  return reply.code(201).send({ task: result.task.toProps() });
}

export async function schedulerRoutes(server: AuthFastifyInstance) {
  server.get('/tasks', { preHandler: [server.authenticate] }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { taskRepo } = makeRepos();
    const { tasks } = await new ListScheduledTasksUseCase(taskRepo).execute({ userId });
    return reply.send({ tasks: tasks.map((t) => t.toProps()), count: tasks.length });
  });

  server.post<{ Body: CreateBody }>('/tasks', { preHandler: [server.authenticate] }, createTaskHandler);

  server.patch<{ Params: { id: string }; Body: UpdateBody }>('/tasks/:id', { preHandler: [server.authenticate] }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { taskRepo } = makeRepos();
    const result = await new UpdateScheduledTaskUseCase(taskRepo).execute({ taskId: req.params.id, userId, ...req.body });
    return reply.send({ task: result.task.toProps() });
  });

  server.delete<{ Params: { id: string } }>('/tasks/:id', { preHandler: [server.authenticate] }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { taskRepo } = makeRepos();
    await new DeleteScheduledTaskUseCase(taskRepo).execute({ taskId: req.params.id, userId });
    return reply.send({ deleted: true });
  });

  server.post<{ Params: { id: string } }>('/tasks/:id/run', { preHandler: [server.authenticate] }, async (req, reply) => {
    const { taskRepo, runRepo } = makeRepos();
    const executor = createAgentExecutor({ logger: server.log as unknown as Logger });
    const uc = new RunScheduledTaskUseCase(taskRepo, runRepo, executor);
    const result = await uc.execute({ taskId: req.params.id });
    return reply.code(202).send({ run: result.run.toProps() });
  });

  server.get<{ Params: { id: string } }>('/tasks/:id/runs', { preHandler: [server.authenticate] }, async (req, reply) => {
    const { runRepo } = makeRepos();
    const runs = await runRepo.findByTaskId(req.params.id, 20);
    return reply.send({ runs: runs.map((r) => r.toProps()) });
  });

  server.get('/runs/pending-review', { preHandler: [server.authenticate] }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { runRepo } = makeRepos();
    const runs = await runRepo.findAwaitingReview(userId);
    return reply.send({ runs: runs.map((r) => r.toProps()), count: runs.length });
  });

  server.post<{ Params: { id: string }; Body: { verdict: 'validated' | 'rejected'; note?: string } }>('/runs/:id/review', { preHandler: [server.authenticate] }, async (req, reply) => {
    const { runRepo } = makeRepos();
    const body = req.body;
    if (!body?.verdict) return reply.code(400).send({ error: 'verdict required' });
    const result = await new ReviewTaskRunUseCase(runRepo).execute({
      runId: req.params.id, verdict: body.verdict,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });
    return reply.send({ run: result.run.toProps() });
  });
}
