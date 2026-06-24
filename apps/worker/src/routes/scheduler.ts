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
import { validate, z } from '../validation';

function makeRepos() {
  const r = getRepos();
  return { taskRepo: r.scheduledTask, runRepo: r.taskRun };
}

const createTaskBody = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(4096).optional(),
  cronExpression: z.string().min(1).max(128),
  prompt: z.string().min(1).max(8192),
  agentId: z.string().max(128).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

const updateTaskBody = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(4096).optional(),
  cronExpression: z.string().min(1).max(128).optional(),
  prompt: z.string().min(1).max(8192).optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

const reviewRunBody = z.object({
  verdict: z.enum(['validated', 'rejected']),
  note: z.string().max(4096).optional(),
});

async function createTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = validate(createTaskBody, req.body);
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

  server.post('/tasks', { preHandler: [server.authenticate] }, createTaskHandler);

  server.patch<{ Params: { id: string } }>('/tasks/:id', { preHandler: [server.authenticate] }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const body = validate(updateTaskBody, req.body);
    const { taskRepo } = makeRepos();
    const result = await new UpdateScheduledTaskUseCase(taskRepo).execute({
      taskId: req.params.id,
      userId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.cronExpression !== undefined ? { cronExpression: body.cronExpression } : {}),
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
    });
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

  server.post<{ Params: { id: string } }>('/runs/:id/review', { preHandler: [server.authenticate] }, async (req, reply) => {
    const { runRepo } = makeRepos();
    const body = validate(reviewRunBody, req.body);
    const result = await new ReviewTaskRunUseCase(runRepo).execute({
      runId: req.params.id, verdict: body.verdict,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });
    return reply.send({ run: result.run.toProps() });
  });
}
