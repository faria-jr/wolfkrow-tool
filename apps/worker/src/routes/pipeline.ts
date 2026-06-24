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
import { validate, z } from '../validation';

function makeRepos() {
  const r = getRepos();
  return {
    projectRepo: r.pipelineProject,
    phaseRepo: r.pipelinePhase,
  };
}

const createProjectBody = z.object({
  userId: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  description: z.string().max(8192).optional(),
});
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

async function runImplementationViaHarness(
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply,
): Promise<unknown> {
  const { projectRepo, phaseRepo } = _repos;
  const r = getRepos();
  const body = validate(runPhaseBody, req.body ?? {});
  try {
    const { planner } = await getHarnessAgents({ maxRoundsPerFeature: 5, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' });
    const result = await new ImplementViaHarnessUseCase({
      pipelineProjectRepo: projectRepo,
      pipelinePhaseRepo: phaseRepo,
      harnessProjectRepo: r.harnessProject,
      harnessSprintRepo: r.harnessSprint,
      planner,
      artifactWriter: getArtifactWriter(),
    }).execute({
      projectId: req.params.id,
      phaseId: req.params.phaseId,
      ...(body.userPrompt !== undefined ? { inlineSpec: body.userPrompt } : {}),
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
  req: FastifyRequest<{ Params: RunParams }>,
  reply: FastifyReply,
): Promise<unknown> {
  const { projectRepo, phaseRepo } = _repos;
  const body = validate(runPhaseBody, req.body ?? {});
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });

  const apiKey = await getAnthropicApiKey();
  const aiProvider = getAdapters().aiFactory.create('anthropic', apiKey);

  // compose the phase prompt with the user's enabled global rules.
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
      ...(body.userPrompt !== undefined ? { userPrompt: body.userPrompt } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
    });
    return { phase: result.phase.toProps(), project: result.project.toProps(), output: result.output };
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
  return runAiPhase(req, reply);
}

async function approvePhaseHandler(req: FastifyRequest<{ Params: RunParams }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  const body = validate(approveBody, req.body);
  try {
    const { project, phase } = await new ApprovePipelinePhaseUseCase(projectRepo, phaseRepo).execute({
      projectId: req.params.id, phaseId: req.params.phaseId,
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

  server.post('/projects', async (req) => {
    const body = validate(createProjectBody, req.body);
    const { project } = await new CreatePipelineProjectUseCase(projectRepo).execute({
      userId: body.userId,
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
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

  server.post<{ Params: { id: string } }>('/projects/:id/phases', async (req, reply) => {
    const body = validate(startPhaseBody, req.body);
    try {
      const { phase } = await new StartPhaseUseCase(projectRepo, phaseRepo).execute({
        projectId: req.params.id,
        stage: body.stage as Parameters<InstanceType<typeof StartPhaseUseCase>['execute']>[0]['stage'],
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

  // consolidated Markdown report of a project's phases + outputs.
  server.get<{ Params: { id: string } }>('/projects/:id/report', reportHandler);

  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/run', runPhaseHandler);
  server.post<{ Params: RunParams }>('/projects/:id/phases/:phaseId/approve', approvePhaseHandler);
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
