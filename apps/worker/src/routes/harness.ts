/**
 * Harness routes — project CRUD, sprint planning, coder/evaluator loop.
 * B.1: Planner→Coder→Evaluator pipeline with max rounds per feature.
 */

import { readFile } from 'node:fs/promises';

import {
  EvaluateRoundUseCase,
  PlanSprintsUseCase,
  ReplayRunEventsUseCase,
  RunCoderRoundUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getHarnessAgents, getHarnessProjectWorkDir, getRepos, makeCoderWithTools } from '../container';
import { recordFeedback } from '../harness/feedback-store';
import { abortRun } from '../harness/run-registry';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

import { sprintChatHandler } from './harness-chat';
import {
  createProjectHandler,
  deleteHarnessProjectHandler,
  getHarnessProjectHandler,
  harnessRepos,
  listHarnessProjectsHandler,
} from './harness-projects';
import { streamSprintRun } from './harness-sse';

const planBody = z.object({ specContent: z.string().max(500_000).optional() });
const coderBody = z.object({
  featureIndex: z.number().int().min(0),
  roundNumber: z.number().int().min(1),
  previousFeedback: z.string().max(65_536).optional(),
});
const runBody = z.object({ sprintId: z.string().min(1).max(128) });
const feedbackBody = z.object({
  featureIndex: z.number().int().min(0),
  text: z.string().min(1).max(65_536),
});

async function planHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  const body = validate(planBody, req.body ?? {});
  let specContent = body.specContent ?? '';
  if (!specContent && project.specPath) {
    try {
      specContent = await readFile(project.specPath, 'utf8');
    } catch {
      specContent = '';
    }
  }
  const userId = req.user?.userId;
  const { planner } = await getHarnessAgents(project.config, userId);
  const { sprints } = await new PlanSprintsUseCase(projectRepo, sprintRepo, planner).execute({
    projectId: project.id,
    specContent,
  });
  return sprints.map((s) => s.toProps());
}

async function runCoderHandler(
  req: FastifyRequest<{ Params: { id: string; sprintId: string } }>,
  reply: FastifyReply
) {
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  const body = validate(coderBody, req.body);
  const userId = req.user?.userId;
  const { coder } = await getHarnessAgents(project.config, userId);
  const { round } = await new RunCoderRoundUseCase(sprintRepo, roundRepo, coder).execute({
    sprintId: req.params.sprintId,
    featureIndex: body.featureIndex,
    roundNumber: body.roundNumber,
    coderModel: project.config.coderModel,
    ...(body.previousFeedback !== undefined ? { previousFeedback: body.previousFeedback } : {}),
  });
  return round.toProps();
}

async function runSseHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const body = validate(runBody, req.body);
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });

  const sprint = await sprintRepo.findById(body.sprintId);
  if (!sprint) return reply.status(404).send({ error: 'Sprint not found' });

  const workDir = project.projectPath ?? getHarnessProjectWorkDir(project.id);
  const userId = req.user?.userId;
  const coder = await makeCoderWithTools(workDir, project.config, userId);
  const { evaluator } = await getHarnessAgents(project.config, userId);
  const { SmokeTestRunner } = await import('@wolfkrow/infra');
  const smokeRunner = new SmokeTestRunner();

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

  await streamSprintRun({
    project,
    sprint,
    coder,
    evaluator,
    smokeRunner,
    repos: { sprintRepo, roundRepo },
    sse,
  });
  reply.raw.end();
}

async function evaluateHandler(
  req: FastifyRequest<{ Params: { roundId: string } }>,
  reply: FastifyReply
) {
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  try {
    const round = await roundRepo.findById(req.params.roundId);
    if (!round) return reply.status(404).send({ error: 'Round not found' });
    const sprint = await sprintRepo.findById(round.sprintId);
    const project = sprint ? await projectRepo.findById(sprint.projectId) : null;
    const config = project?.config ?? {
      maxRoundsPerFeature: 5,
      coderModel: 'claude-sonnet-4-6',
      plannerModel: 'claude-opus-4-8',
    };
    const userId = req.user?.userId;
    const { evaluator } = await getHarnessAgents(config, userId);
    const result = await new EvaluateRoundUseCase(roundRepo, evaluator).execute({
      roundId: req.params.roundId,
    });
    return { ...result.round.toProps(), passed: result.passed };
  } catch {
    return reply.status(404).send({ error: 'Round not found' });
  }
}

async function sprintsListHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { projectRepo, sprintRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  return (await sprintRepo.findByProjectId(project.id)).map((s) => s.toProps());
}

async function roundsListHandler(req: FastifyRequest<{ Params: { sprintId: string } }>) {
  const { roundRepo } = harnessRepos();
  return (await roundRepo.findBySprintId(req.params.sprintId)).map((r) => r.toProps());
}

async function abortHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  return reply.send({ ok: abortRun(req.params.id) });
}

/** GET /projects/:id/run-events — replay the persisted run timeline (console restore). */
async function runEventsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { events } = await new ReplayRunEventsUseCase(getRepos().runEvent).execute(
    `harness:${req.params.id}`
  );
  return reply.send({ events: events.map((e) => e.toProps()) });
}

/** POST /projects/:id/feedback — park operator HITL feedback for a feature. */
async function feedbackHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply
) {
  const body = validate(feedbackBody, req.body);
  recordFeedback(req.params.id, body.featureIndex, body.text);
  return reply.send({
    accepted: true,
    message: `Feedback received for feature ${body.featureIndex + 1}. It will guide the next coder round when the sprint resumes.`,
  });
}

type IdParams = { Params: { id: string } };

export async function harnessRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };

  server.post('/projects', auth, createProjectHandler);
  server.get('/projects', auth, listHarnessProjectsHandler);
  server.get<IdParams>('/projects/:id', auth, getHarnessProjectHandler);
  server.delete<IdParams>('/projects/:id', auth, deleteHarnessProjectHandler);
  server.post<IdParams>('/projects/:id/plan', auth, planHandler);
  server.post<{ Params: { id: string; sprintId: string } }>('/projects/:id/sprints/:sprintId/run-coder', auth, runCoderHandler);
  server.post<{ Params: { roundId: string } }>('/rounds/:roundId/evaluate', auth, evaluateHandler);
  server.get<IdParams>('/projects/:id/sprints', auth, sprintsListHandler);
  server.get<{ Params: { sprintId: string } }>('/sprints/:sprintId/rounds', auth, roundsListHandler);
  server.post<IdParams>('/projects/:id/run', auth, runSseHandler);
  // DEBT #29 — server-side abort.
  server.post<IdParams>('/projects/:id/abort', auth, abortHandler);
  // Persisted run timeline replay — lets the console restore after reconnect.
  server.get<IdParams>('/projects/:id/run-events', auth, runEventsHandler);
  // Operator HITL feedback — parked and drained into the next coder round.
  server.post<IdParams & { Body: unknown }>('/projects/:id/feedback', auth, feedbackHandler);
  // F2.1 — conversational HITL: streams a real LLM reply (also parks as feedback).
  server.post<IdParams & { Body: unknown }>('/projects/:id/sprint-chat', auth, async (req, reply) => {
    await sprintChatHandler(req, reply, harnessRepos().projectRepo);
  });
}
