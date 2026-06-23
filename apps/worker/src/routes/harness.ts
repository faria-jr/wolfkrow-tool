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
  RunCoderRoundUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getHarnessAgents, getHarnessProjectWorkDir, makeCoderWithTools, getRepos } from '../container';
import type { FeatureRunResult } from '../harness/runner';
import { runHarnessFeature } from '../harness/runner';
import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  const r = getRepos();
  return {
    projectRepo: r.harnessProject,
    sprintRepo: r.harnessSprint,
    roundRepo: r.harnessRound,
  };
}

interface CreateProjectBody { userId: string; name: string; specPath: string; description?: string; maxRoundsPerFeature?: number; }
interface PlanBody { specContent?: string; }
type CoderBody = { featureIndex: number; roundNumber: number; previousFeedback?: string };

const _hRepos = makeRepos();

async function planHandler(req: FastifyRequest<{ Params: { id: string }; Body: PlanBody }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo } = _hRepos;
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  let specContent = req.body.specContent ?? '';
  if (!specContent && project.specPath) {
    try { specContent = await readFile(project.specPath, 'utf8'); } catch { specContent = ''; }
  }
  const { sprints } = await new PlanSprintsUseCase(projectRepo, sprintRepo, getHarnessAgents().planner).execute({ projectId: project.id, specContent });
  return sprints.map((s) => s.toProps());
}

async function runCoderHandler(req: FastifyRequest<{ Params: { id: string; sprintId: string }; Body: CoderBody }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo, roundRepo } = _hRepos;
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  const { round } = await new RunCoderRoundUseCase(sprintRepo, roundRepo, getHarnessAgents().coder).execute({
    sprintId: req.params.sprintId,
    featureIndex: req.body.featureIndex,
    roundNumber: req.body.roundNumber,
    coderModel: project.config.coderModel,
    ...(req.body.previousFeedback !== undefined ? { previousFeedback: req.body.previousFeedback } : {}),
  });
  return round.toProps();
}

interface RunBody { sprintId: string; }

async function runSseHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: RunBody }>,
  reply: FastifyReply,
) {
  const { projectRepo, sprintRepo, roundRepo } = _hRepos;
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });

  const sprint = await sprintRepo.findById(req.body.sprintId);
  if (!sprint) return reply.status(404).send({ error: 'Sprint not found' });

  const workDir = getHarnessProjectWorkDir(project.id);
  const coder = makeCoderWithTools(workDir);
  const { evaluator } = getHarnessAgents();

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

  const results: FeatureRunResult[] = [];

  for (let i = 0; i < sprint.features.length; i++) {
    const result = await runHarnessFeature(
      { sprintId: sprint.id, featureIndex: i, coderModel: project.config.coderModel, maxRounds: project.config.maxRoundsPerFeature },
      { sprintRepo, roundRepo },
      { coder, evaluator },
      (event) => sse({ type: 'progress', sprintId: sprint.id, featureIndex: i, ...event }),
    );
    results.push(result);
    sse({ type: 'feature_done', ...result });
  }

  sse({ type: 'done', results });
  reply.raw.end();
}

export async function harnessRoutes(server: AuthFastifyInstance) {
  const { projectRepo, sprintRepo, roundRepo } = _hRepos;

  server.post<{ Body: CreateProjectBody }>('/projects', async (req) => {
    const { project } = await new CreateHarnessProjectUseCase(projectRepo).execute(req.body);
    return project.toProps();
  });

  server.get<{ Querystring: { userId: string } }>('/projects', async (req) => {
    const { projects } = await new ListHarnessProjectsUseCase(projectRepo).execute({ userId: req.query.userId });
    return projects.map((p) => p.toProps());
  });

  server.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    try {
      const { project } = await new GetHarnessProjectUseCase(projectRepo).execute({ projectId: req.params.id });
      return project.toProps();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/projects/:id', async (req, reply) => {
    try {
      await new DeleteHarnessProjectUseCase(projectRepo).execute({ projectId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  server.post<{ Params: { id: string }; Body: PlanBody }>('/projects/:id/plan', planHandler);

  server.post<{ Params: { id: string; sprintId: string }; Body: CoderBody }>(
    '/projects/:id/sprints/:sprintId/run-coder', runCoderHandler,
  );

  server.post<{ Params: { roundId: string } }>('/rounds/:roundId/evaluate', async (req, reply) => {
    try {
      const result = await new EvaluateRoundUseCase(roundRepo, getHarnessAgents().evaluator).execute({ roundId: req.params.roundId });
      return { ...result.round.toProps(), passed: result.passed };
    } catch {
      return reply.status(404).send({ error: 'Round not found' });
    }
  });

  server.get<{ Params: { id: string } }>('/projects/:id/sprints', async (req, reply) => {
    const project = await projectRepo.findById(req.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return (await sprintRepo.findByProjectId(project.id)).map((s) => s.toProps());
  });

  server.get<{ Params: { sprintId: string } }>('/sprints/:sprintId/rounds', async (req) => {
    return (await roundRepo.findBySprintId(req.params.sprintId)).map((r) => r.toProps());
  });

  server.post<{ Params: { id: string }; Body: RunBody }>('/projects/:id/run', runSseHandler);
}
