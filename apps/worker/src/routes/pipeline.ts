/**
 * Pipeline routes — discovery→spec→validate→approval→implementation lifecycle.
 * B.2: BuildPlan pipeline with AI-driven phases.
 * M5.7: `implementation` stage delegates to the Harness (creates Harness project +
 * sprints) instead of running AI directly.
 */

import { NotFoundError } from '@wolfkrow/domain';
import {
  ApprovePipelinePhaseUseCase,
  BuildSystemPromptUseCase,
  CreatePipelineProjectUseCase,
  DeletePipelineProjectUseCase,
  GeneratePipelineReportUseCase,
  GetPipelineProjectUseCase,
  ImplementViaHarnessUseCase,
  ListPipelineProjectsUseCase,
  RunPhaseUseCase,
  StartPhaseUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getAdapters, getArtifactWriter, getHarnessAgents, getRepos } from '../container';
import { getAnthropicApiKey } from '../lib/keychain';
import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  const r = getRepos();
  return {
    projectRepo: r.pipelineProject,
    phaseRepo: r.pipelinePhase,
  };
}

interface CreateProjectBody { userId: string; name: string; description?: string; }
interface StartPhaseBody { stage: string; }
interface RunPhaseBody { userPrompt?: string; model?: string; }
interface ApproveBody { approved: boolean; notes?: string; specEdits?: string; }

const _repos = makeRepos();

type RunParams = { id: string; phaseId: string };

async function runImplementationViaHarness(
  req: FastifyRequest<{ Params: RunParams; Body: RunPhaseBody }>,
  reply: FastifyReply,
): Promise<unknown> {
  const { projectRepo, phaseRepo } = _repos;
  const r = getRepos();
  try {
    const result = await new ImplementViaHarnessUseCase({
      pipelineProjectRepo: projectRepo,
      pipelinePhaseRepo: phaseRepo,
      harnessProjectRepo: r.harnessProject,
      harnessSprintRepo: r.harnessSprint,
      planner: getHarnessAgents({ maxRoundsPerFeature: 5, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' }).planner,
      artifactWriter: getArtifactWriter(),
    }).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      ...(req.body.userPrompt !== undefined ? { inlineSpec: req.body.userPrompt } : {}),
    });
    return {
      phase: result.phase.toProps(),
      project: result.pipeline.toProps(),
      output: result.artifact,
      harnessProjectId: result.harness.toProps().id,
      sprintCount: result.sprints.length,
    };
  } catch (err) {
    req.log.error({ err }, 'ImplementViaHarnessUseCase failed');
    return reply.status(500).send({ error: 'Implementation via Harness failed' });
  }
}

async function runAiPhase(
  req: FastifyRequest<{ Params: RunParams; Body: RunPhaseBody }>,
  reply: FastifyReply,
): Promise<unknown> {
  const { projectRepo, phaseRepo } = _repos;
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });

  const apiKey = await getAnthropicApiKey();
  const aiProvider = getAdapters().aiFactory.create('anthropic', apiKey);

  // FIX-004: compose the phase prompt with the user's enabled global rules.
  const phaseSystemPrompt = await new BuildSystemPromptUseCase(getRepos().globalRule).execute({
    userId: project.userId,
    agentSystemPrompt: 'You are a helpful assistant.',
  });

  const wrappedProvider = {
    query: aiProvider.query.bind(aiProvider),
    complete: async (opts: Parameters<typeof aiProvider.complete>[0]) =>
      aiProvider.complete({ ...opts, system: opts.system ? `${phaseSystemPrompt}\n\n${opts.system}` : phaseSystemPrompt }),
  };

  try {
    const result = await new RunPhaseUseCase(
      projectRepo, phaseRepo, wrappedProvider,
      { messageRepo: getRepos().pipelineMessage, artifactWriter: getArtifactWriter() },
    ).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      ...(req.body.userPrompt !== undefined ? { userPrompt: req.body.userPrompt } : {}),
      ...(req.body.model !== undefined ? { model: req.body.model } : {}),
    });
    return { phase: result.phase.toProps(), project: result.project.toProps(), output: result.output };
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

async function runPhaseHandler(req: FastifyRequest<{ Params: RunParams; Body: RunPhaseBody }>, reply: FastifyReply) {
  const { phaseRepo } = _repos;
  const phase = await phaseRepo.findById(req.params.phaseId);
  if (!phase) return reply.status(404).send({ error: 'Phase not found' });

  if (phase.stage === 'implementation') {
    return runImplementationViaHarness(req, reply);
  }
  return runAiPhase(req, reply);
}

async function approvePhaseHandler(req: FastifyRequest<{ Params: RunParams; Body: ApproveBody }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  try {
    const { project, phase } = await new ApprovePipelinePhaseUseCase(projectRepo, phaseRepo).execute({
      projectId: req.params.id, phaseId: req.params.phaseId,
      approved: req.body.approved,
      ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
      ...(req.body.specEdits !== undefined ? { specEdits: req.body.specEdits } : {}),
    });
    return { project: project.toProps(), phase: phase.toProps() };
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
}

export async function pipelineRoutes(server: AuthFastifyInstance) {
  const { projectRepo, phaseRepo } = _repos;

  server.post<{ Body: CreateProjectBody }>('/projects', async (req) => {
    const { project } = await new CreatePipelineProjectUseCase(projectRepo).execute(req.body);
    return project.toProps();
  });

  server.get<{ Querystring: { userId: string } }>('/projects', async (req) => {
    const { projects } = await new ListPipelineProjectsUseCase(projectRepo).execute({ userId: req.query.userId });
    return projects.map((p) => p.toProps());
  });

  server.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    try {
      const { project } = await new GetPipelineProjectUseCase(projectRepo).execute({ projectId: req.params.id });
      return project.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/projects/:id', async (req, reply) => {
    try {
      await new DeletePipelineProjectUseCase(projectRepo).execute({ projectId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.post<{ Params: { id: string }; Body: StartPhaseBody }>('/projects/:id/phases', async (req, reply) => {
    try {
      const { phase } = await new StartPhaseUseCase(projectRepo, phaseRepo).execute({
        projectId: req.params.id,
        stage: req.body.stage as Parameters<InstanceType<typeof StartPhaseUseCase>['execute']>[0]['stage'],
      });
      return phase.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  server.get<{ Params: { id: string } }>('/projects/:id/phases', async (req) => {
    const phases = await phaseRepo.findByProjectId(req.params.id);
    return phases.map((p) => p.toProps());
  });

  // T26 (tech_debt): consolidated Markdown report of a project's phases + outputs.
  server.get<{ Params: { id: string } }>('/projects/:id/report', reportHandler);

  server.post<{ Params: RunParams; Body: RunPhaseBody }>('/projects/:id/phases/:phaseId/run', runPhaseHandler);
  server.post<{ Params: RunParams; Body: ApproveBody }>('/projects/:id/phases/:phaseId/approve', approvePhaseHandler);
}

async function reportHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  try {
    const { report } = await new GeneratePipelineReportUseCase(
      projectRepo, phaseRepo, getRepos().pipelineMessage,
    ).execute({ projectId: req.params.id });
    return { report };
  } catch (err) {
    if (err instanceof NotFoundError) return reply.status(404).send({ error: 'Not found' });
    req.log.error({ err }, 'Pipeline report error');
    return reply.status(500).send({ error: 'Report generation failed' });
  }
}
