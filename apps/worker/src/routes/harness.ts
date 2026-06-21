/**
 * Harness routes — project CRUD, sprint planning, coder/evaluator loop.
 * B.1: Planner→Coder→Evaluator pipeline with max rounds per feature.
 */

import { DrizzleHarnessProjectRepo, DrizzleHarnessRoundRepo, DrizzleHarnessSprintRepo, aiProviderFactory } from '@wolfkrow/infra';
import {
  CreateHarnessProjectUseCase,
  DeleteHarnessProjectUseCase,
  EvaluateRoundUseCase,
  GetHarnessProjectUseCase,
  ListHarnessProjectsUseCase,
  PlanSprintsUseCase,
  RunCoderRoundUseCase,
} from '@wolfkrow/use-cases';
import { readFile } from 'node:fs/promises';
import keytar from 'keytar';

import type { AuthFastifyInstance } from '../types/fastify';
import type { HarnessPlanner, CoderAgent, EvaluatorAgent } from '@wolfkrow/use-cases';

function makeRepos() {
  return {
    projectRepo: new DrizzleHarnessProjectRepo(),
    sprintRepo: new DrizzleHarnessSprintRepo(),
    roundRepo: new DrizzleHarnessRoundRepo(),
  };
}

async function getApiKey(): Promise<string> {
  const key = await keytar.getPassword('wolfkrow', 'anthropic-api-key');
  if (!key) throw new Error('Missing anthropic-api-key in system keychain');
  return key;
}

function createLlmPlanner(): HarnessPlanner {
  return {
    async plan(specContent, config) {
      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: config.plannerModel,
        system: 'You are a senior software architect. Given a spec, output a JSON array of sprints. Each sprint: {name, description, features: [{name, description, acceptanceCriteria: string[]}]}. Respond ONLY with valid JSON array.',
        messages: [{ role: 'user', content: `Create sprint plan for:\n\n${specContent}` }],
        maxTokens: 4096,
        temperature: 0.3,
      });
      try {
        const raw = result.content.match(/\[[\s\S]*\]/)?.[0] ?? result.content;
        return JSON.parse(raw) as Array<{ name: string; description: string; features: Array<{ name: string; description: string; acceptanceCriteria: string[] }> }>;
      } catch {
        return [{ name: 'Sprint 1', description: specContent.slice(0, 200), features: [{ name: 'Implementation', description: specContent.slice(0, 500), acceptanceCriteria: ['All features implemented'] }] }];
      }
    },
  };
}

function createLlmCoder(): CoderAgent {
  return {
    async implement(input) {
      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
      const previousContext = input.previousFeedback ? `\n\nPrevious evaluator feedback:\n${input.previousFeedback}` : '';
      const result = await provider.complete({
        model: input.coderModel,
        system: 'You are an expert software engineer. Implement the requested feature with clean, tested code.',
        messages: [{
          role: 'user',
          content: `Sprint: ${input.sprintName}\nFeature: ${input.featureName}\nDescription: ${input.featureDescription}\nAcceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}${previousContext}\n\nImplement this feature completely.`,
        }],
        maxTokens: 8192,
        temperature: 0.2,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}

function createLlmEvaluator(): EvaluatorAgent {
  return {
    async evaluate(input) {
      const apiKey = await getApiKey();
      const provider = aiProviderFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: 'claude-sonnet-4-6',
        system: 'You are a QA engineer. Evaluate if the implementation meets the acceptance criteria. Respond with JSON: {passed: boolean, feedback: string}',
        messages: [{
          role: 'user',
          content: `Acceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}\n\nImplementation:\n${input.coderOutput}\n\nDoes this implementation satisfy all acceptance criteria?`,
        }],
        maxTokens: 1024,
        temperature: 0.1,
      });
      try {
        const raw = result.content.match(/\{[\s\S]*\}/)?.[0] ?? result.content;
        const parsed = JSON.parse(raw) as { passed: boolean; feedback: string };
        return { ...parsed, tokens: result.usage.inputTokens + result.usage.outputTokens };
      } catch {
        return { passed: false, feedback: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
      }
    },
  };
}

interface CreateProjectBody { userId: string; name: string; specPath: string; description?: string; maxRoundsPerFeature?: number; }
interface PlanBody { specContent?: string; }

export async function harnessRoutes(server: AuthFastifyInstance) {
  const { projectRepo, sprintRepo, roundRepo } = makeRepos();

  // POST /harness/projects
  server.post<{ Body: CreateProjectBody }>('/projects', async (req) => {
    const uc = new CreateHarnessProjectUseCase(projectRepo);
    const { project } = await uc.execute(req.body);
    return project.toProps();
  });

  // GET /harness/projects?userId=
  server.get<{ Querystring: { userId: string } }>('/projects', async (req) => {
    const uc = new ListHarnessProjectsUseCase(projectRepo);
    const { projects } = await uc.execute({ userId: req.query.userId });
    return projects.map((p) => p.toProps());
  });

  // GET /harness/projects/:id
  server.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const uc = new GetHarnessProjectUseCase(projectRepo);
    try {
      const { project } = await uc.execute({ projectId: req.params.id });
      return project.toProps();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  // DELETE /harness/projects/:id
  server.delete<{ Params: { id: string }; Querystring: { userId: string } }>('/projects/:id', async (req, reply) => {
    const uc = new DeleteHarnessProjectUseCase(projectRepo);
    try {
      await uc.execute({ projectId: req.params.id, userId: req.query.userId });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Project not found' });
    }
  });

  // POST /harness/projects/:id/plan
  server.post<{ Params: { id: string }; Body: PlanBody }>('/projects/:id/plan', async (req, reply) => {
    const project = await projectRepo.findById(req.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    let specContent = req.body.specContent ?? '';
    if (!specContent && project.specPath) {
      try { specContent = await readFile(project.specPath, 'utf8'); } catch { specContent = ''; }
    }

    const uc = new PlanSprintsUseCase(projectRepo, sprintRepo, createLlmPlanner());
    const { sprints } = await uc.execute({ projectId: project.id, specContent });
    return sprints.map((s) => s.toProps());
  });

  // POST /harness/projects/:id/sprints/:sprintId/run-coder
  server.post<{ Params: { id: string; sprintId: string }; Body: { featureIndex: number; roundNumber: number; previousFeedback?: string } }>(
    '/projects/:id/sprints/:sprintId/run-coder',
    async (req, reply) => {
      const project = await projectRepo.findById(req.params.id);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      const uc = new RunCoderRoundUseCase(sprintRepo, roundRepo, createLlmCoder());
      const { round } = await uc.execute({
        sprintId: req.params.sprintId,
        featureIndex: req.body.featureIndex,
        roundNumber: req.body.roundNumber,
        coderModel: project.config.coderModel,
        ...(req.body.previousFeedback !== undefined ? { previousFeedback: req.body.previousFeedback } : {}),
      });
      return round.toProps();
    },
  );

  // POST /harness/rounds/:roundId/evaluate
  server.post<{ Params: { roundId: string } }>('/rounds/:roundId/evaluate', async (req, reply) => {
    const uc = new EvaluateRoundUseCase(roundRepo, createLlmEvaluator());
    try {
      const result = await uc.execute({ roundId: req.params.roundId });
      return { ...result.round.toProps(), passed: result.passed };
    } catch {
      return reply.status(404).send({ error: 'Round not found' });
    }
  });

  // GET /harness/projects/:id/sprints
  server.get<{ Params: { id: string } }>('/projects/:id/sprints', async (req, reply) => {
    const project = await projectRepo.findById(req.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    const sprints = await sprintRepo.findByProjectId(project.id);
    return sprints.map((s) => s.toProps());
  });

  // GET /harness/sprints/:sprintId/rounds
  server.get<{ Params: { sprintId: string } }>('/sprints/:sprintId/rounds', async (req) => {
    const rounds = await roundRepo.findBySprintId(req.params.sprintId);
    return rounds.map((r) => r.toProps());
  });
}
