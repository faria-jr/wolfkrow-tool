/**
 * Harness routes — project CRUD, sprint planning, coder/evaluator loop.
 * B.1: Planner→Coder→Evaluator pipeline with max rounds per feature.
 */

import { readFile } from 'node:fs/promises';

import {
  CreateHarnessProjectUseCase,
  DeleteHarnessProjectUseCase,
  EvaluateRoundUseCase,
  GetHarnessProjectUseCase,
  ListHarnessProjectsUseCase,
  PlanSprintsUseCase,
  ReplayRunEventsUseCase,
  RunCoderRoundUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../config';
import {
  getHarnessAgents,
  getHarnessProjectWorkDir,
  makeCoderWithTools,
  getRepos,
} from '../container';
import { recordFeedback } from '../harness/feedback-store';
import { abortRun } from '../harness/run-registry';
import { validateProjectPath, validateSpecPath } from '../lib/project-path';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

import { streamSprintRun } from './harness-sse';

function harnessRepos() {
  const r = getRepos();
  return {
    projectRepo: r.harnessProject,
    sprintRepo: r.harnessSprint,
    roundRepo: r.harnessRound,
  };
}

const createProjectBody = z.object({
  name: z.string().min(1).max(256),
  specPath: z.string().min(1).max(4096),
  projectPath: z.string().max(4096).optional(),
  description: z.string().max(8192).optional(),
  maxRoundsPerFeature: z.number().int().min(1).max(50).optional(),
});
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
const sharedWorkspace = () => config.WOLFKROW_SHARED_WORKSPACE !== 'false';

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

async function createProjectHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user?.userId ?? 'anonymous';
  const body = validate(createProjectBody, req.body);
  const checkedSpec = validateSpecPath(body.specPath);
  if (!checkedSpec.ok) return reply.status(400).send({ error: checkedSpec.reason });
  body.specPath = checkedSpec.path;
  if (body.projectPath !== undefined) {
    const checked = validateProjectPath(body.projectPath);
    if (!checked.ok) return reply.status(400).send({ error: checked.reason });
    body.projectPath = checked.path;
  }
  const { project } = await new CreateHarnessProjectUseCase(harnessRepos().projectRepo).execute({
    userId,
    name: body.name,
    specPath: body.specPath,
    ...(body.projectPath !== undefined ? { projectPath: body.projectPath } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.maxRoundsPerFeature !== undefined
      ? { maxRoundsPerFeature: body.maxRoundsPerFeature }
      : {}),
  });
  return project.toProps();
}

async function listHarnessProjectsHandler(req: FastifyRequest) {
  const userId = req.user?.userId ?? 'anonymous';
  const projectRepo = harnessRepos().projectRepo;
  const projects = sharedWorkspace()
    ? await projectRepo.findAll()
    : (await new ListHarnessProjectsUseCase(projectRepo).execute({ userId })).projects;
  return projects.map((p) => p.toProps());
}

async function getHarnessProjectHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { project } = await new GetHarnessProjectUseCase(harnessRepos().projectRepo).execute({
      projectId: req.params.id,
    });
    return project.toProps();
  } catch {
    return reply.status(404).send({ error: 'Project not found' });
  }
}

async function deleteHarnessProjectHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const projectRepo = harnessRepos().projectRepo;
    if (sharedWorkspace()) {
      const project = await projectRepo.findById(req.params.id);
      if (!project) return reply.status(404).send({ error: 'Project not found' });
      await projectRepo.delete(req.params.id);
    } else {
      const userId = req.user?.userId ?? 'anonymous';
      await new DeleteHarnessProjectUseCase(projectRepo).execute({
        projectId: req.params.id,
        userId,
      });
    }
    return reply.status(204).send();
  } catch {
    return reply.status(404).send({ error: 'Project not found' });
  }
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
}
