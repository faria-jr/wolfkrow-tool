/**
 * Pipeline routes — discovery→spec→validate→approval→implementation lifecycle.
 * B.2: BuildPlan pipeline with AI-driven phases.
 * `implementation` stage delegates to the Harness (creates Harness project +
 * sprints) instead of running AI directly.
 */

import { NotFoundError } from '@wolfkrow/domain';
import {
  ApprovePipelinePhaseUseCase,
  BuildSystemPromptUseCase,
  GeneratePipelineReportUseCase,
  RunPhaseUseCase,
  StartPhaseUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getArtifactWriter, getRepos } from '../container';
import { resolveAIProvider } from '../lib/provider-resolver';
import { registerRun, unregisterRun } from '../lib/run-control';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate, z } from '../validation';

import {
  continuePhaseChat,
  runDesignBootstrap,
  runDesignLock,
  runImplementationViaHarness,
} from './pipeline-design';
import { registerPipelineProjectRoutes } from './pipeline-project-routes';
import {
  abortPhaseHandler,
  pausePhaseHandler,
  resumePhaseHandler,
  runStateHandler,
} from './pipeline-run-control';

function makeRepos() {
  const r = getRepos();
  return {
    projectRepo: r.pipelineProject,
    phaseRepo: r.pipelinePhase,
  };
}

const startPhaseBody = z.object({ stage: z.string().min(1).max(64) });
const runPhaseBody = z.object({
  userPrompt: z.string().max(200_000).optional(),
  model: z.string().max(128).optional(),
});
const approveBody = z.object({
  approved: z.boolean(),
  notes: z.string().max(16_384).optional(),
  specEdits: z.string().max(200_000).optional(),
});

const _repos = makeRepos();

type RunParams = { id: string; phaseId: string };

async function runAiPhase(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
): Promise<unknown> {
  const { projectRepo, phaseRepo } = _repos;
  const body = validate(runPhaseBody, req.body ?? {});
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });

  const { provider: aiProvider } = await resolveAIProvider({
    model: body.model,
    userId: project.userId,
  });

  // compose the phase prompt with the user's enabled global rules.
  const phaseSystemPrompt = await new BuildSystemPromptUseCase(getRepos().globalRule).execute({
    userId: project.userId,
    agentSystemPrompt: 'You are a helpful assistant.',
  });

  const wrappedProvider = {
    query: aiProvider.query.bind(aiProvider),
    complete: async (opts: Parameters<typeof aiProvider.complete>[0]) =>
      aiProvider.complete({
        ...opts,
        system: opts.system ? `${phaseSystemPrompt}\n\n${opts.system}` : phaseSystemPrompt,
      }),
  };

  try {
    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, wrappedProvider, {
      messageRepo: getRepos().pipelineMessage,
      artifactWriter: getArtifactWriter(),
    }).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      ...(body.userPrompt !== undefined ? { userPrompt: body.userPrompt } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
    });
    return {
      phase: result.phase.toProps(),
      project: result.project.toProps(),
      output: result.output,
    };
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

async function runPhaseHandler(req: FastifyRequest<{ Params: RunParams }>, reply: FastifyReply) {
  const { phaseRepo } = _repos;
  const phase = await phaseRepo.findById(req.params.phaseId);
  if (!phase) return reply.status(404).send({ error: 'Phase not found' });

  if (phase.stage === 'implementation') {
    return runImplementationViaHarness(req, reply);
  }
  if (phase.stage === 'design') {
    return runDesignBootstrap(req, reply);
  }
  if (phase.stage === 'design_lock') {
    return runDesignLock(req, reply);
  }
  return runAiPhase(req, reply);
}

/** Runs an AI (non-implementation) pipeline phase and emits phase-complete. */
async function streamAiPhase(
  req: FastifyRequest<{ Params: RunParams }>,
  sse: (data: unknown) => void
): Promise<void> {
  const { projectRepo, phaseRepo: pr } = _repos;
  const body = validate(runPhaseBody, req.body ?? {});
  const project = await projectRepo.findById(req.params.id);
  if (!project) throw new Error('Project not found');

  const { provider: aiProvider } = await resolveAIProvider({
    model: body.model,
    userId: project.userId,
  });
  const phaseSystemPrompt = await new BuildSystemPromptUseCase(getRepos().globalRule).execute({
    userId: project.userId,
    agentSystemPrompt: 'You are a helpful assistant.',
  });
  const wrappedProvider = {
    query: aiProvider.query.bind(aiProvider),
    complete: async (opts: Parameters<typeof aiProvider.complete>[0]) =>
      aiProvider.complete({
        ...opts,
        system: opts.system ? `${phaseSystemPrompt}\n\n${opts.system}` : phaseSystemPrompt,
      }),
  };
  const result = await new RunPhaseUseCase(projectRepo, pr, wrappedProvider, {
    messageRepo: getRepos().pipelineMessage,
    artifactWriter: getArtifactWriter(),
  }).execute({
    projectId: req.params.id,
    phaseId: req.params.phaseId,
    ...(body.userPrompt !== undefined ? { userPrompt: body.userPrompt } : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
  });
  sse({
    type: 'phase-complete',
    output: result.output,
    phase: result.phase.toProps(),
    project: result.project.toProps(),
  });
}

async function runPhaseSseHandler(req: FastifyRequest<{ Params: RunParams }>, reply: FastifyReply) {
  const { phaseRepo } = _repos;
  const phase = await phaseRepo.findById(req.params.phaseId);
  if (!phase) return reply.status(404).send({ error: 'Phase not found' });

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const sse = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

  // Register the phase run so /abort, /pause, /resume routes can control it
  // server-side (mirrors the Harness run registry). isAborted is checked after
  // the AI step; the loop is single-step per phase, so abort stops further work.
  const handle = registerRun(req.params.phaseId);
  sse({ type: 'phase-start', stage: phase.stage, phaseId: phase.id });

  try {
    if (phase.stage === 'implementation') {
      const result = await runImplementationViaHarness(req, reply);
      if (handle.isAborted()) {
        sse({ type: 'aborted', phaseId: phase.id });
      } else if (result && typeof result === 'object') {
        sse({ type: 'phase-complete', ...result });
      }
    } else {
      await streamAiPhase(req, sse);
      if (handle.isAborted()) sse({ type: 'aborted', phaseId: phase.id });
    }
  } catch (err) {
    sse({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
  }
  sse({ type: 'done' });
  unregisterRun(req.params.phaseId);
  reply.raw.end();
}

/** POST /projects/:id/phases/:phaseId/approve — approve/withhold a phase. */
async function approvePhaseHandler(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply
) {
  const { projectRepo, phaseRepo } = _repos;
  const body = validate(approveBody, req.body);
  try {
    const { project, phase } = await new ApprovePipelinePhaseUseCase(
      projectRepo,
      phaseRepo
    ).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      approved: body.approved,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.specEdits !== undefined ? { specEdits: body.specEdits } : {}),
    });
    return { project: project.toProps(), phase: phase.toProps() };
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

export async function pipelineRoutes(server: AuthFastifyInstance) {
  const { projectRepo, phaseRepo } = _repos;

  // Pipeline projects + phases are user-scoped. Require an authenticated
  // session on every route so anonymous callers cannot drive another user's
  // discovery→spec→implementation pipeline (the default-user leak class of
  // P0-7/P2-1).
  const auth = { onRequest: [server.authenticate] };

  registerPipelineProjectRoutes(server, projectRepo, auth);
  registerPipelinePhaseRoutes(server, projectRepo, phaseRepo, auth);

  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/run', auth, runPhaseHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/run/stream', auth, runPhaseSseHandler);
  // Server-side run control (mirrors Harness): abort/pause/resume an in-flight
  // phase so the expensive AI loop actually stops, not just the SSE consumer.
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/abort', auth, abortPhaseHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/pause', auth, pausePhaseHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/resume', auth, resumePhaseHandler);
  server.get<{ Params: RunParams }>('/projects/:id/phases/:phaseId/run-state', auth, runStateHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/approve', auth, approvePhaseHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/chat', auth, continuePhaseChat);
}

/** Phase routes: start, list, report. */
function registerPipelinePhaseRoutes(
  server: AuthFastifyInstance,
  projectRepo: ReturnType<typeof makeRepos>['projectRepo'],
  phaseRepo: ReturnType<typeof makeRepos>['phaseRepo'],
  auth: { onRequest: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> }
): void {
  server.post<{ Params: { id: string } }>('/projects/:id/phases', auth, async (req, reply) => {
    const body = validate(startPhaseBody, req.body);
    try {
      const { phase } = await new StartPhaseUseCase(projectRepo, phaseRepo).execute({
        projectId: req.params.id,
        stage: body.stage as Parameters<
          InstanceType<typeof StartPhaseUseCase>['execute']
        >[0]['stage'],
      });
      return phase.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.get<{ Params: { id: string } }>('/projects/:id/phases', auth, async (req) => {
    const phases = await phaseRepo.findByProjectId(req.params.id);
    return phases.map((p) => p.toProps());
  });

  // consolidated Markdown report of a project's phases + outputs.
  server.get<{ Params: { id: string } }>('/projects/:id/report', auth, reportHandler);
}

async function reportHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  try {
    const { report } = await new GeneratePipelineReportUseCase(
      projectRepo,
      phaseRepo,
      getRepos().pipelineMessage
    ).execute({ projectId: req.params.id });
    return { report };
  } catch (err) {
    if (err instanceof NotFoundError) return reply.status(404).send({ error: 'Not found' });
    req.log.error({ err }, 'Pipeline report error');
    return reply.status(500).send({ error: 'Report generation failed' });
  }
}
