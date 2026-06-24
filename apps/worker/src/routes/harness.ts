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

function harnessRepos() {
  const r = getRepos();
  return {
    projectRepo: r.harnessProject,
    sprintRepo: r.harnessSprint,
    roundRepo: r.harnessRound,
  };
}

interface CreateProjectBody { name: string; specPath: string; description?: string; maxRoundsPerFeature?: number; }
interface PlanBody { specContent?: string; }
type CoderBody = { featureIndex: number; roundNumber: number; previousFeedback?: string };

async function planHandler(req: FastifyRequest<{ Params: { id: string }; Body: PlanBody }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  let specContent = req.body.specContent ?? '';
  if (!specContent && project.specPath) {
    try { specContent = await readFile(project.specPath, 'utf8'); } catch { specContent = ''; }
  }
  const userId = req.user?.userId;
  const { planner } = await getHarnessAgents(project.config, userId);
  const { sprints } = await new PlanSprintsUseCase(projectRepo, sprintRepo, planner).execute({ projectId: project.id, specContent });
  return sprints.map((s) => s.toProps());
}

async function runCoderHandler(req: FastifyRequest<{ Params: { id: string; sprintId: string }; Body: CoderBody }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  const userId = req.user?.userId;
  const { coder } = await getHarnessAgents(project.config, userId);
  const { round } = await new RunCoderRoundUseCase(sprintRepo, roundRepo, coder).execute({
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
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });

  const sprint = await sprintRepo.findById(req.body.sprintId);
  if (!sprint) return reply.status(404).send({ error: 'Sprint not found' });

  const workDir = getHarnessProjectWorkDir(project.id);
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

  const results: FeatureRunResult[] = [];

  for (let i = 0; i < sprint.features.length; i++) {
    const result = await runHarnessFeature(
      {
        sprintId: sprint.id,
        featureIndex: i,
        coderModel: project.config.coderModel,
        maxRounds: project.config.maxRoundsPerFeature,
        workDir,
      },
      { sprintRepo, roundRepo },
      { coder, evaluator, smokeRunner },
      (event) => sse({ type: 'progress', sprintId: sprint.id, featureIndex: i, ...event }),
    );
    results.push(result);
    sse({ type: 'feature_done', ...result });
  }

  sse({ type: 'done', results });
  reply.raw.end();
}

async function evaluateHandler(req: FastifyRequest<{ Params: { roundId: string } }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo, roundRepo } = harnessRepos();
  try {
    const round = await roundRepo.findById(req.params.roundId);
    if (!round) return reply.status(404).send({ error: 'Round not found' });
    const sprint = await sprintRepo.findById(round.sprintId);
    const project = sprint ? await projectRepo.findById(sprint.projectId) : null;
    const config = project?.config ?? { maxRoundsPerFeature: 5, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' };
    const userId = req.user?.userId;
    const { evaluator } = await getHarnessAgents(config, userId);
    const result = await new EvaluateRoundUseCase(roundRepo, evaluator).execute({ roundId: req.params.roundId });
    return { ...result.round.toProps(), passed: result.passed };
  } catch {
    return reply.status(404).send({ error: 'Round not found' });
  }
}

async function sprintsListHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  return (await sprintRepo.findByProjectId(project.id)).map((s) => s.toProps());
}

async function roundsListHandler(req: FastifyRequest<{ Params: { sprintId: string } }>) {
  const { roundRepo } = harnessRepos();
  return (await roundRepo.findBySprintId(req.params.sprintId)).map((r) => r.toProps());
}

export async function harnessRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };
  const projectRepo = () => harnessRepos().projectRepo;

  server.post<{ Body: CreateProjectBody }>('/projects', auth, async (req) => {
    const userId = req.user?.userId ?? 'anonymous';
    const { project } = await new CreateHarnessProjectUseCase(projectRepo()).execute({ ...req.body, userId });
    return project.toProps();
  });

  server.get('/projects', auth, async (req) => {
    const userId = req.user?.userId ?? 'anonymous';
    const { projects } = await new ListHarnessProjectsUseCase(projectRepo()).execute({ userId });
    return projects.map((p) => p.toProps());
  });

  server.get<{ Params: { id: string } }>('/projects/:id', auth, async (req, reply) => {
    try {
      const { project } = await new GetHarnessProjectUseCase(projectRepo()).execute({ projectId: req.params.id });
      return project.toProps();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  server.delete<{ Params: { id: string } }>('/projects/:id', auth, async (req, reply) => {
    try {
      const userId = req.user?.userId ?? 'anonymous';
      await new DeleteHarnessProjectUseCase(projectRepo()).execute({ projectId: req.params.id, userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  server.post<{ Params: { id: string }; Body: PlanBody }>('/projects/:id/plan', auth, planHandler);

  server.post<{ Params: { id: string; sprintId: string }; Body: CoderBody }>(
    '/projects/:id/sprints/:sprintId/run-coder', auth, runCoderHandler,
  );

  server.post<{ Params: { roundId: string } }>('/rounds/:roundId/evaluate', auth, evaluateHandler);

  server.get<{ Params: { id: string } }>('/projects/:id/sprints', auth, sprintsListHandler);

  server.get<{ Params: { sprintId: string } }>('/sprints/:sprintId/rounds', auth, roundsListHandler);

  server.post<{ Params: { id: string }; Body: RunBody }>('/projects/:id/run', auth, runSseHandler);
}
