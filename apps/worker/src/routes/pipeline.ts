/**
 * Pipeline routes — discovery→spec→validate→approval→implementation lifecycle.
 * B.2: BuildPlan pipeline with AI-driven phases.
 */

import {
  ApprovePipelinePhaseUseCase,
  BuildSystemPromptUseCase,
  CreatePipelineProjectUseCase,
  DeletePipelineProjectUseCase,
  GetPipelineProjectUseCase,
  ListPipelineProjectsUseCase,
  RunPhaseUseCase,
  StartPhaseUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';
import keytar from 'keytar';

import { getAdapters, getRepos } from '../container';
import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  const r = getRepos();
  return {
    projectRepo: r.pipelineProject,
    phaseRepo: r.pipelinePhase,
  };
}

async function getApiKey(): Promise<string> {
  const key = await keytar.getPassword('wolfkrow', 'anthropic-api-key');
  if (!key) throw new Error('Missing anthropic-api-key in system keychain');
  return key;
}

interface CreateProjectBody { userId: string; name: string; description?: string; }
interface StartPhaseBody { stage: string; }
interface RunPhaseBody { userPrompt?: string; model?: string; }
interface ApproveBody { approved: boolean; notes?: string; }

const _repos = makeRepos();

type RunParams = { id: string; phaseId: string };
async function runPhaseHandler(req: FastifyRequest<{ Params: RunParams; Body: RunPhaseBody }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  const project = await projectRepo.findById(req.params.id);
  if (!project) return reply.status(404).send({ error: 'Not found' });

  const apiKey = await getApiKey();
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
    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, wrappedProvider).execute({
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

async function approvePhaseHandler(req: FastifyRequest<{ Params: RunParams; Body: ApproveBody }>, reply: FastifyReply) {
  const { projectRepo, phaseRepo } = _repos;
  try {
    const { project, phase } = await new ApprovePipelinePhaseUseCase(projectRepo, phaseRepo).execute({
      projectId: req.params.id, phaseId: req.params.phaseId,
      approved: req.body.approved,
      ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
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

  server.post<{ Params: RunParams; Body: RunPhaseBody }>('/projects/:id/phases/:phaseId/run', runPhaseHandler);
  server.post<{ Params: RunParams; Body: ApproveBody }>('/projects/:id/phases/:phaseId/approve', approvePhaseHandler);
}
