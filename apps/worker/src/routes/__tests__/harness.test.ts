/**
 * Harness routes — project CRUD + sprint/round listing + 404 paths.
 *
 * The plan/run-coder/evaluate/run(SSE) handlers need AI agents and are not
 * covered here. Mocking the harness repos with in-memory fakes (backed by real
 * entities) exercises the real CRUD + list route logic. Auth uses the
 * real-behaving decorator (preHandler) so 401-without-session is genuine.
 */

import type { HarnessSprint, HarnessRound } from '@wolfkrow/domain';
import { HarnessProject } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';


const { projects, sprints, rounds, fakeProjectRepo, fakeSprintRepo, fakeRoundRepo } = vi.hoisted(() => {
  const projects = new Map<string, HarnessProject>();
  const sprints = new Map<string, HarnessSprint>();
  const rounds = new Map<string, HarnessRound>();

  const fakeProjectRepo = {
    findById: async (id: string) => projects.get(id) ?? null,
    findByUserId: async (userId: string) => [...projects.values()].filter((p) => p.userId === userId),
    save: async (p: HarnessProject) => {
      projects.set(p.id, p);
      return p;
    },
    delete: async (id: string) => {
      projects.delete(id);
    },
  };
  const fakeSprintRepo = {
    findById: async (id: string) => sprints.get(id) ?? null,
    findByProjectId: async (projectId: string) =>
      [...sprints.values()].filter((s) => (s as unknown as { projectId: string }).projectId === projectId),
    save: async (s: HarnessSprint) => {
      sprints.set(s.id, s);
      return s;
    },
  };
  const fakeRoundRepo = {
    findById: async (id: string) => rounds.get(id) ?? null,
    findBySprintId: async (sprintId: string) =>
      [...rounds.values()].filter((r) => (r as unknown as { sprintId: string }).sprintId === sprintId),
    findBySprintAndFeature: async () => [] as HarnessRound[],
    save: async (r: HarnessRound) => {
      rounds.set(r.id, r);
      return r;
    },
  };
  return { projects, sprints, rounds, fakeProjectRepo, fakeSprintRepo, fakeRoundRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    harnessProject: fakeProjectRepo,
    harnessSprint: fakeSprintRepo,
    harnessRound: fakeRoundRepo,
  }),
  getHarnessAgents: vi.fn(),
  getHarnessProjectWorkDir: () => '/tmp/wolfkrow-harness',
  makeCoderWithTools: vi.fn(),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { harnessRoutes } from '../harness';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  projects.clear();
  sprints.clear();
  rounds.clear();
  const seeded = HarnessProject.create({
    userId: 'u1', name: 'Acme harness', specPath: '/tmp/spec.md', description: 'd',
    config: { maxRoundsPerFeature: 5, coderModel: 'claude-sonnet-4-6', plannerModel: 'claude-opus-4-8' },
  });
  projects.set(seeded.id, seeded);

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await harnessRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('harness routes — authentication', () => {
  it('GET /projects without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(401);
  });
});

describe('harness POST /projects — create', () => {
  it('creates a project and returns its props', async () => {
    const res = await app.inject({
      method: 'POST', url: '/projects', headers: BEARER,
      payload: { name: 'New harness', specPath: '/tmp/x.md' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string; userId: string };
    expect(body.name).toBe('New harness');
    expect(body.userId).toBe('u1');
  });

  it('rejects a body missing specPath → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', headers: BEARER, payload: { name: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-existent projectPath → 400 (EPIC 1.1 path safety)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/projects', headers: BEARER,
      payload: { name: 'Bad path', specPath: '/tmp/x.md', projectPath: '/definitely/not/a/real/dir/xyz' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: expect.stringContaining('projectPath') });
  });
});

describe('harness GET /projects — list', () => {
  it('returns projects for the authenticated user', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string }[];
    expect(body.some((p) => p.name === 'Acme harness')).toBe(true);
  });
});

describe('harness GET /projects/:id', () => {
  it('returns the project when found', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme harness')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { id: string }).id).toBe(existing.id);
  });

  it('returns 404 when not found', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/unknown', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});

describe('harness DELETE /projects/:id', () => {
  it('deletes an owned project and returns 204', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'New harness')!;
    const res = await app.inject({ method: 'DELETE', url: `/projects/${existing.id}`, headers: BEARER });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when not found', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/unknown', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});

describe('harness GET /projects/:id/sprints — list sprints', () => {
  it('returns sprints for an existing project (empty when none)', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme harness')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}/sprints`, headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/unknown/sprints', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});

describe('harness GET /sprints/:sprintId/rounds — list rounds', () => {
  it('returns rounds for a sprint', async () => {
    const res = await app.inject({ method: 'GET', url: '/sprints/s-1/rounds', headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('harness POST /projects/:id/plan — 404 when project missing', () => {
  it('returns 404 for an unknown project', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects/unknown/plan', headers: BEARER, payload: {} });
    expect(res.statusCode).toBe(404);
  });
});

describe('harness POST /rounds/:roundId/evaluate — 404 when round missing', () => {
  it('returns 404 for an unknown round', async () => {
    const res = await app.inject({ method: 'POST', url: '/rounds/unknown/evaluate', headers: BEARER });
    expect(res.statusCode).toBe(404);
  });
});
