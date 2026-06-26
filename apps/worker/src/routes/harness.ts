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
import { abortRun, registerRun, unregisterRun } from '../harness/run-registry';
import type { FeatureRunResult } from '../harness/runner';
import { runHarnessFeature } from '../harness/runner';
import { validateProjectPath } from '../lib/project-path';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

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

async function planHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { projectRepo, sprintRepo } = harnessRepos();
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Project not found' });
  const body = validate(planBody, req.body ?? {});
  let specContent = body.specContent ?? '';
  if (!specContent && project.specPath) {
    try { specContent = await readFile(project.specPath, 'utf8'); } catch { specContent = ''; }
  }
  const userId = req.user?.userId;
  const { planner } = await getHarnessAgents(project.config, userId);
  const { sprints } = await new PlanSprintsUseCase(projectRepo, sprintRepo, planner).execute({ projectId: project.id, specContent });
  return sprints.map((s) => s.toProps());
}

async function runCoderHandler(req: FastifyRequest<{ Params: { id: string; sprintId: string } }>, reply: FastifyReply) {
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

interface SprintRunDeps {
  project: { id: string; config: { maxRoundsPerFeature: number; coderModel: string }; projectPath: string | undefined };
  sprint: { id: string; features: readonly unknown[] };
  coder: unknown;
  evaluator: unknown;
  smokeRunner: unknown;
  repos: { sprintRepo: unknown; roundRepo: unknown };
  sse: (data: unknown) => void;
}

/** Runs each sprint feature through the harness loop, emitting SSE + honoring abort. */
async function streamSprintRun(deps: SprintRunDeps): Promise<void> {
  const isAborted = registerRun(deps.project.id);
  const results: FeatureRunResult[] = [];
  const workDir = deps.project.projectPath ?? getHarnessProjectWorkDir(deps.project.id);
  try {
    for (let i = 0; i < deps.sprint.features.length; i++) {
      if (isAborted()) { deps.sse({ type: 'aborted', featureIndex: i }); break; }
      const result = await runHarnessFeature(
        { sprintId: deps.sprint.id, featureIndex: i, coderModel: deps.project.config.coderModel, maxRounds: deps.project.config.maxRoundsPerFeature, workDir },
        deps.repos as Parameters<typeof runHarnessFeature>[1],
        { coder: deps.coder, evaluator: deps.evaluator, smokeRunner: deps.smokeRunner } as Parameters<typeof runHarnessFeature>[2],
        {
          onProgress: (event) => deps.sse({ type: 'progress', sprintId: deps.sprint.id, featureIndex: i, ...event }),
          onCoderChunk: (delta) => deps.sse({ type: 'coder-chunk', sprintId: deps.sprint.id, featureIndex: i, delta }),
          shouldAbort: isAborted,
        },
      );
      results.push(result);
      deps.sse({ type: 'feature_done', ...result });
    }
    deps.sse({ type: 'done', results });
  } finally {
    unregisterRun(deps.project.id);
  }
}

async function runSseHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
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

  await streamSprintRun({ project, sprint, coder, evaluator, smokeRunner, repos: { sprintRepo, roundRepo }, sse });
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

async function createProjectHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user?.userId ?? 'anonymous';
  const body = validate(createProjectBody, req.body);
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
    ...(body.maxRoundsPerFeature !== undefined ? { maxRoundsPerFeature: body.maxRoundsPerFeature } : {}),
  });
  return project.toProps();
}

export async function harnessRoutes(server: AuthFastifyInstance) {
  const auth = { preHandler: [server.authenticate] };
  const projectRepo = () => harnessRepos().projectRepo;

  server.post('/projects', auth, createProjectHandler);

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

  server.post<{ Params: { id: string } }>('/projects/:id/plan', auth, planHandler);

  server.post<{ Params: { id: string; sprintId: string } }>(
    '/projects/:id/sprints/:sprintId/run-coder', auth, runCoderHandler,
  );

  server.post<{ Params: { roundId: string } }>('/rounds/:roundId/evaluate', auth, evaluateHandler);

  server.get<{ Params: { id: string } }>('/projects/:id/sprints', auth, sprintsListHandler);

  server.get<{ Params: { sprintId: string } }>('/sprints/:sprintId/rounds', auth, roundsListHandler);

  server.post<{ Params: { id: string } }>('/projects/:id/run', auth, runSseHandler);

  // DEBT #29 — server-side abort: stops the in-flight coder/evaluator loop.
  server.post<{ Params: { id: string } }>('/projects/:id/abort', auth, async (req, reply) => {
    return reply.send({ ok: abortRun(req.params.id) });
  });
}
