/**
 * Tests: EPIC 1.2 — POST /projects/:id/phases/:phaseId/run/stream SSE route.
 *
 * Use-cases + adapters are stubbed so the test asserts SSE event sequencing
 * (phase-start → phase-complete → done) and the 404-when-phase-missing branch,
 * not AI behavior. Mirrors harness-run.test.ts's mocking strategy.
 */

import { PipelinePhase, PipelineProject } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakePhaseRepo, fakeProjectRepo } = vi.hoisted(() => {
  const phases = new Map<string, PipelinePhase>();
  const projects = new Map<string, PipelineProject>();
  return {
    fakePhaseRepo: {
      findById: async (id: string) => phases.get(id) ?? null,
      findByProjectId: async () => [...phases.values()],
      save: async (p: PipelinePhase) => {
        phases.set(p.id, p);
        return p;
      },
    },
    fakeProjectRepo: {
      findById: async (id: string) => projects.get(id) ?? null,
      findByUserId: async () => [...projects.values()],
      save: async (p: PipelineProject) => {
        projects.set(p.id, p);
        return p;
      },
      delete: async (id: string) => {
        projects.delete(id);
      },
    },
  };
});

vi.mock('@wolfkrow/use-cases', () => {
  const phase = { toProps: () => ({ stage: 'discovery', status: 'completed' }) };
  const project = { toProps: () => ({ currentStage: 'discovery', status: 'active' }) };
  return {
    RunPhaseUseCase: class {
      async execute() {
        return { phase, project, output: 'AI output', tokens: 10 };
      }
    },
    ImplementViaHarnessUseCase: class {
      async execute() {
        return {
          phase: { toProps: () => ({ stage: 'implementation', status: 'completed' }) },
          pipeline: project,
          artifact: 'impl artifact',
          harness: { toProps: () => ({ id: 'hp-1' }) },
          sprints: [{ id: 's1' }, { id: 's2' }],
        };
      }
    },
    ApprovePipelinePhaseUseCase: class {
      async execute() {
        return { project, phase };
      }
    },
    BuildSystemPromptUseCase: class {
      async execute() {
        return 'sys-prompt';
      }
    },
    CreatePipelineProjectUseCase: class {
      async execute() {
        return { project };
      }
    },
    DeletePipelineProjectUseCase: class {
      async execute() {
        /* noop */
      }
    },
    GeneratePipelineReportUseCase: class {
      async execute() {
        return { report: '# r' };
      }
    },
    GetPipelineProjectUseCase: class {
      async execute() {
        return { project };
      }
    },
    ListPipelineProjectsUseCase: class {
      async execute() {
        return { projects: [] };
      }
    },
    StartPhaseUseCase: class {
      async execute() {
        return { phase };
      }
    },
  };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    pipelineProject: fakeProjectRepo,
    pipelinePhase: fakePhaseRepo,
    pipelineMessage: { findByProjectId: async () => [] },
    harnessProject: { findById: async () => null, save: async () => undefined },
    harnessSprint: { save: async () => undefined },
    globalRule: { findAll: async () => [] },
  }),
  getArtifactWriter: () => ({ write: vi.fn() }),
  getHarnessAgents: vi.fn().mockResolvedValue({ planner: { plan: async () => ({ sprints: [] }) } }),
  getAdapters: () => ({
    aiFactory: {
      create: () => ({
        query: vi.fn(),
        complete: async () => ({ content: 'ok', usage: { inputTokens: 1, outputTokens: 1 } }),
      }),
      createFromConfig: () => ({
        query: vi.fn(),
        complete: async () => ({ content: 'ok', usage: { inputTokens: 1, outputTokens: 1 } }),
      }),
    },
    secrets: { get: vi.fn(async () => null) },
  }),
}));

vi.mock('../../lib/keychain', () => ({
  KEYTAR_SERVICE: 'wolfkrow',
  getProviderApiKey: vi.fn(async () => 'sk-test'),
  getAnthropicApiKey: vi.fn(async () => 'sk-test'),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { pipelineRoutes } from '../pipeline';

import { authedDecorator, setErrorHandler } from './helpers/app';

function parseSSE(body: string): unknown[] {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)));
}

let app: FastifyInstance;
let projectId: string;
let discoveryPhaseId: string;
let implPhaseId: string;

beforeAll(async () => {
  const project = PipelineProject.create({ userId: 'u1', name: 'SSE project' });
  await fakeProjectRepo.save(project);
  projectId = project.id;

  const discovery = PipelinePhase.create({ projectId, stage: 'discovery' });
  const impl = PipelinePhase.create({ projectId, stage: 'implementation' });
  await fakePhaseRepo.save(discovery);
  await fakePhaseRepo.save(impl);
  discoveryPhaseId = discovery.id;
  implPhaseId = impl.id;

  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await pipelineRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /projects/:id/phases/:phaseId/run/stream SSE route', () => {
  it('returns 404 when the phase does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/phases/unknown/run/stream`,
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('streams phase-start, phase-complete and done for an AI phase', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/phases/${discoveryPhaseId}/run/stream`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSSE(res.body);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'phase-start', stage: 'discovery' })
    );
    expect(events).toContainEqual(expect.objectContaining({ type: 'phase-complete' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'done' }));
  });

  it('streams phase-complete with harness linkage for the implementation phase', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/phases/${implPhaseId}/run/stream`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const events = parseSSE(res.body);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'phase-complete', harnessProjectId: 'hp-1', sprintCount: 2 })
    );
    expect(events).toContainEqual(expect.objectContaining({ type: 'done' }));
  });
});
