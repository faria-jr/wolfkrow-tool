/**
 * Pipeline routes — project CRUD + phase start/approve + report + 404 paths.
 *
 * The run-phase AI/harness path is not covered (needs heavy AI deps); the
 * 404-when-phase-missing branch IS covered. Mocking the pipeline repos with
 * in-memory fakes (backed by real entities) exercises the real route logic.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

import { PipelineProject, PipelinePhase } from '@wolfkrow/domain';

const { projects, phases, fakeProjectRepo, fakePhaseRepo, fakePipelineMessageRepo } = vi.hoisted(() => {
  const projects = new Map<string, PipelineProject>();
  const phases = new Map<string, PipelinePhase>();

  const fakeProjectRepo = {
    findById: async (id: string) => projects.get(id) ?? null,
    findByUserId: async (userId: string) => [...projects.values()].filter((p) => p.userId === userId),
    save: async (p: PipelineProject) => {
      projects.set(p.id, p);
      return p;
    },
    delete: async (id: string) => {
      projects.delete(id);
    },
  };

  const fakePhaseRepo = {
    findById: async (id: string) => phases.get(id) ?? null,
    findByProjectId: async (projectId: string) =>
      [...phases.values()].filter((p) => (p as unknown as { projectId: string }).projectId === projectId),
    save: async (p: PipelinePhase) => {
      phases.set(p.id, p);
      return p;
    },
  };

  const fakePipelineMessageRepo = {
    findByProjectId: async () => [],
  };
  return { projects, phases, fakeProjectRepo, fakePhaseRepo, fakePipelineMessageRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    pipelineProject: fakeProjectRepo,
    pipelinePhase: fakePhaseRepo,
    pipelineMessage: fakePipelineMessageRepo,
    harnessProject: { findById: async () => null, save: async () => undefined },
    harnessSprint: { save: async () => undefined },
  }),
  getArtifactWriter: () => ({ write: vi.fn() }),
  getHarnessAgents: vi.fn(),
}));

vi.mock('../../lib/keychain', () => ({ getAnthropicApiKey: vi.fn(async () => 'sk-test') }));

import { pipelineRoutes } from '../pipeline';
import type { AuthFastifyInstance } from '../../types/fastify';
import { setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  projects.clear();
  phases.clear();
  const seeded = PipelineProject.create({ userId: 'u1', name: 'Acme build' });
  projects.set(seeded.id, seeded);

  app = Fastify();
  setErrorHandler(app);
  await pipelineRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('pipeline POST /projects — create', () => {
  it('creates a project and returns its props', async () => {
    const res = await app.inject({
      method: 'POST', url: '/projects',
      payload: { userId: 'u1', name: 'New pipeline', description: 'd' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string; userId: string };
    expect(body.name).toBe('New pipeline');
    expect(body.userId).toBe('u1');
  });

  it('rejects a body missing name → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', payload: { userId: 'u1' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('pipeline GET /projects — list', () => {
  it('returns projects for a user', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects?userId=u1' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string }[];
    expect(body.some((p) => p.name === 'Acme build')).toBe(true);
  });
});

describe('pipeline GET /projects/:id', () => {
  it('returns the project when found', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}` });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { id: string }).id).toBe(existing.id);
  });

  it('returns 404 when not found', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('pipeline DELETE /projects/:id', () => {
  it('deletes an owned project and returns 204', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'New pipeline')!;
    const res = await app.inject({ method: 'DELETE', url: `/projects/${existing.id}?userId=u1` });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when the project is not found', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/unknown?userId=u1' });
    expect(res.statusCode).toBe(404);
  });
});

describe('pipeline POST /projects/:id/phases — start phase', () => {
  it('starts a phase for an existing project', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({
      method: 'POST', url: `/projects/${existing.id}/phases`,
      payload: { stage: 'discovery' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { stage: string };
    expect(body.stage).toBe('discovery');
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await app.inject({
      method: 'POST', url: '/projects/unknown/phases', payload: { stage: 'discovery' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a body missing stage → 400', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({ method: 'POST', url: `/projects/${existing.id}/phases`, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('pipeline GET /projects/:id/phases — list phases', () => {
  it('returns phases for a project', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}/phases` });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('pipeline GET /projects/:id/report', () => {
  it('returns a markdown report for an existing project', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}/report` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { report: string };
    expect(typeof body.report).toBe('string');
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/unknown/report' });
    expect(res.statusCode).toBe(404);
  });
});

describe('pipeline POST /projects/:id/phases/:phaseId/run — 404 when phase missing', () => {
  it('returns 404 when the phase does not exist', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({
      method: 'POST', url: `/projects/${existing.id}/phases/unknown/run`, payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('pipeline POST /projects/:id/phases/:phaseId/approve', () => {
  it('rejects a body missing approved → 400', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({
      method: 'POST', url: `/projects/${existing.id}/phases/unknown/approve`, payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the project/phase is not found', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme build')!;
    const res = await app.inject({
      method: 'POST', url: `/projects/${existing.id}/phases/unknown/approve`,
      payload: { approved: true },
    });
    expect(res.statusCode).toBe(404);
  });
});
