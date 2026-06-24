/**
 * Tests: T25 — POST /projects/:id/run SSE harness loop route.
 */

import { HarnessProject, HarnessSprint } from '@wolfkrow/domain';
import Fastify from 'fastify';
import { describe, beforeEach, expect, it, vi } from 'vitest';

import { makeCoderWithTools, getHarnessProjectWorkDir } from '../../container';
import type { AuthFastifyInstance } from '../../types/fastify';
import { harnessRoutes } from '../harness';

const { mockProjectRepo, mockSprintRepo, mockRoundRepo, mockRunHarnessFeature } = vi.hoisted(() => ({
  mockProjectRepo: {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
  mockSprintRepo: {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    save: vi.fn(),
  },
  mockRoundRepo: {
    findById: vi.fn(),
    findBySprintId: vi.fn(),
    findBySprintAndFeature: vi.fn(),
    save: vi.fn(),
  },
  mockRunHarnessFeature: vi.fn(),
}));

vi.mock('../../container', () => ({
  getRepos: vi.fn().mockReturnValue({
    harnessProject: mockProjectRepo,
    harnessSprint: mockSprintRepo,
    harnessRound: mockRoundRepo,
  }),
  makeCoderWithTools: vi.fn().mockReturnValue({ implement: vi.fn() }),
  getHarnessProjectWorkDir: vi.fn().mockReturnValue('/tmp/wolfkrow-harness/proj-1'),
  getHarnessAgents: vi.fn().mockReturnValue({
    evaluator: { evaluate: vi.fn() },
    coder: { implement: vi.fn() },
    planner: { plan: vi.fn() },
  }),
}));

vi.mock('../../harness/runner', () => ({
  runHarnessFeature: mockRunHarnessFeature,
}));

function makeProject() {
  return HarnessProject.fromProps({
    id: 'proj-1',
    userId: 'u1',
    name: 'Test Project',
    description: undefined,
    specPath: '/tmp/spec.md',
    status: 'running',
    config: { maxRoundsPerFeature: 3, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' },
    metrics: { totalTokens: 0, totalCost: 0, roundCount: 0, featuresPassed: 0, featuresTotal: 0, totalDurationMs: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: undefined,
  });
}

function makeSprint() {
  return HarnessSprint.fromProps({
    id: 'sprint-1',
    projectId: 'proj-1',
    number: 1,
    name: 'Sprint 1',
    description: undefined,
    status: 'in_progress',
    features: [{ name: 'Auth', description: 'login flow', acceptanceCriteria: ['must authenticate'] }],
    startedAt: new Date(),
    completedAt: undefined,
    metrics: { roundCount: 0, featuresPassed: 0, featuresTotal: 1, durationMs: 0 },
  });
}

function parseSSE(body: string): unknown[] {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)));
}

async function buildApp() {
  const app = Fastify();
  await app.register(async (instance) => {
    instance.decorate('authenticate', async () => {});
    await harnessRoutes(instance as AuthFastifyInstance);
  });
  await app.ready();
  return app;
}

describe('POST /projects/:id/run SSE route (T25)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockProjectRepo.findById.mockReset();
    mockSprintRepo.findById.mockReset();
    mockRunHarnessFeature.mockReset();
    app = await buildApp();
  });

  it('returns 404 when project not found', async () => {
    mockProjectRepo.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/projects/proj-1/run',
      payload: { sprintId: 'sprint-1' },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Project not found' });
  });

  it('returns 404 when sprint not found', async () => {
    mockProjectRepo.findById.mockResolvedValue(makeProject());
    mockSprintRepo.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/projects/proj-1/run',
      payload: { sprintId: 'sprint-missing' },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Sprint not found' });
  });

  it('streams feature_done and done SSE events for each feature', async () => {
    mockProjectRepo.findById.mockResolvedValue(makeProject());
    mockSprintRepo.findById.mockResolvedValue(makeSprint());
    mockRunHarnessFeature.mockResolvedValue({
      featureIndex: 0,
      rounds: 1,
      passed: true,
      finalOutput: 'code output',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/projects/proj-1/run',
      payload: { sprintId: 'sprint-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSSE(res.body);
    expect(events).toContainEqual(expect.objectContaining({ type: 'feature_done', passed: true, featureIndex: 0 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'done' }));
  });

  it('calls makeCoderWithTools with the project workspace dir', async () => {
    mockProjectRepo.findById.mockResolvedValue(makeProject());
    mockSprintRepo.findById.mockResolvedValue(makeSprint());
    mockRunHarnessFeature.mockResolvedValue({ featureIndex: 0, rounds: 1, passed: false, finalOutput: undefined });

    await app.inject({
      method: 'POST',
      url: '/projects/proj-1/run',
      payload: { sprintId: 'sprint-1' },
    });

    expect(vi.mocked(getHarnessProjectWorkDir)).toHaveBeenCalledWith('proj-1');
    expect(vi.mocked(makeCoderWithTools)).toHaveBeenCalledWith(
      '/tmp/wolfkrow-harness/proj-1',
      { maxRoundsPerFeature: 3, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' },
      undefined,
    );
  });
});
