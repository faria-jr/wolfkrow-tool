/**
 * Pipeline routes — discovery→spec→validate→approval→implementation lifecycle.
 * B.2: BuildPlan pipeline with AI-driven phases.
 */

import {
  DrizzlePipelinePhaseRepo,
  DrizzlePipelineProjectRepo,
  aiProviderFactory,
} from '@wolfkrow/infra';
import {
  ApprovePipelinePhaseUseCase,
  CompletePhaseUseCase,
  CreatePipelineProjectUseCase,
  DeletePipelineProjectUseCase,
  GetPipelineProjectUseCase,
  ListPipelineProjectsUseCase,
  StartPhaseUseCase,
} from '@wolfkrow/use-cases';
import keytar from 'keytar';

import type { AuthFastifyInstance } from '../types/fastify';

function makeRepos() {
  return {
    projectRepo: new DrizzlePipelineProjectRepo(),
    phaseRepo: new DrizzlePipelinePhaseRepo(),
  };
}

async function getApiKey(): Promise<string> {
  const key = await keytar.getPassword('wolfkrow', 'anthropic-api-key');
  if (!key) throw new Error('Missing anthropic-api-key in system keychain');
  return key;
}

const PHASE_PROMPTS: Record<string, string> = {
  discovery: 'You are a product discovery expert. Analyze the project and produce structured discovery notes: problem statement, target users, key requirements, constraints, and success metrics. Be concise and actionable.',
  spec_build: 'You are a technical architect. Based on the discovery notes, build a detailed technical specification: architecture decisions, API contracts, data models, implementation strategy, and risk assessment.',
  spec_validate: 'You are a senior QA engineer. Validate the technical specification for completeness, consistency, and feasibility. List any gaps, contradictions, or risks found. Provide a validation summary.',
};

interface CreateProjectBody { userId: string; name: string; description?: string; }
interface StartPhaseBody { stage: string; }
interface RunPhaseBody { userPrompt?: string; }
interface ApproveBody { approved: boolean; notes?: string; }

export async function pipelineRoutes(server: AuthFastifyInstance) {
  const { projectRepo, phaseRepo } = makeRepos();

  // POST /pipeline/projects
  server.post<{ Body: CreateProjectBody }>('/projects', async (req) => {
    const { project } = await new CreatePipelineProjectUseCase(projectRepo).execute(req.body);
    return project.toProps();
  });

  // GET /pipeline/projects?userId=
  server.get<{ Querystring: { userId: string } }>('/projects', async (req) => {
    const { projects } = await new ListPipelineProjectsUseCase(projectRepo).execute({ userId: req.query.userId });
    return projects.map((p) => p.toProps());
  });

  // GET /pipeline/projects/:id
  server.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    try {
      const { project } = await new GetPipelineProjectUseCase(projectRepo).execute({ projectId: req.params.id });
      return project.toProps();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  // DELETE /pipeline/projects/:id
  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/projects/:id', async (req, reply) => {
    try {
      await new DeletePipelineProjectUseCase(projectRepo).execute({ projectId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  // POST /pipeline/projects/:id/phases — start a phase
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

  // GET /pipeline/projects/:id/phases
  server.get<{ Params: { id: string } }>('/projects/:id/phases', async (req) => {
    const phases = await phaseRepo.findByProjectId(req.params.id);
    return phases.map((p) => p.toProps());
  });

  // POST /pipeline/projects/:id/phases/:phaseId/run — AI execution
  server.post<{ Params: { id: string; phaseId: string }; Body: RunPhaseBody }>(
    '/projects/:id/phases/:phaseId/run',
    async (req, reply) => {
      const [project, phase] = await Promise.all([
        projectRepo.findById(req.params.id),
        phaseRepo.findById(req.params.phaseId),
      ]);
      if (!project || !phase) return reply.status(404).send({ error: 'Not found' });

      const systemPrompt = PHASE_PROMPTS[phase.stage] ?? 'You are a helpful assistant.';
      const userContent = req.body.userPrompt ?? `Project: ${project.name}\n${project.description ?? ''}\nDiscovery notes: ${project.discoveryNotes ?? 'N/A'}`;

      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: 'claude-sonnet-4-6',
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        maxTokens: 4096,
        temperature: 0.3,
      });

      const tokens = result.usage.inputTokens + result.usage.outputTokens;

      const { phase: completed, project: updated } = await new CompletePhaseUseCase(projectRepo, phaseRepo).execute({
        phaseId: phase.id, projectId: project.id, tokens,
      });

      return { phase: completed.toProps(), project: updated.toProps(), output: result.content };
    },
  );

  // POST /pipeline/projects/:id/phases/:phaseId/approve
  server.post<{ Params: { id: string; phaseId: string }; Body: ApproveBody }>(
    '/projects/:id/phases/:phaseId/approve',
    async (req, reply) => {
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
    },
  );
}
