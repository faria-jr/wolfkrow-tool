/**
 * Central Projects routes — CRUD + path validation + 404 paths.
 *
 * The in-memory fake repo (backed by the real Project entity) exercises the
 * real route logic without a DB. Mirrors the pipeline route test harness.
 */

import type { Project } from '@wolfkrow/domain';
import { Project as ProjectEntity } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { projects, fakeProjectRepo } = vi.hoisted(() => {
  const projects = new Map<string, Project>();
  const fakeProjectRepo = {
    findAll: async () => [...projects.values()],
    findById: async (id: string) => projects.get(id) ?? null,
    save: async (p: Project) => {
      projects.set(p.id, p);
      return p;
    },
    delete: async (id: string) => {
      projects.delete(id);
    },
  };
  return { projects, fakeProjectRepo };
});

vi.mock('../../container', () => ({
  getRepos: () => ({
    project: fakeProjectRepo,
    auditLog: { insert: vi.fn() },
  }),
}));

import type { AuthFastifyInstance } from '../../types/fastify';
import { projectRoutes } from '../project-routes';

import { authedDecorator, realAuthenticate, setErrorHandler } from './helpers/app';

let app: FastifyInstance;

beforeAll(async () => {
  projects.clear();
  const seeded = ProjectEntity.create({ userId: 'u1', name: 'Acme repo', rootPath: process.cwd() });
  projects.set(seeded.id, seeded);

  app = Fastify();
  app.decorate('authenticate', authedDecorator);
  setErrorHandler(app);
  await projectRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('projects POST /projects — create', () => {
  it('creates a project and returns its props (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { name: 'New project', description: 'd', rootPath: process.cwd() },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { name: string; userId: string; rootPath: string; status: string };
    expect(body.name).toBe('New project');
    expect(body.userId).toBe('u1');
    expect(body.rootPath).toBe(process.cwd());
    expect(body.status).toBe('active');
  });

  it('rejects a body missing name → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a non-existent rootPath → 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { name: 'Bad path', rootPath: '/definitely/does/not/exist/xyz' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('ignores a spoofed userId in the body (IDOR guard)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { userId: 'victim', name: 'Spoof attempt' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { userId: string };
    expect(body.userId).toBe('u1');
  });
});

describe('projects GET /projects — list', () => {
  it('returns all projects (shared workspace)', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string }[];
    expect(body.some((p) => p.name === 'Acme repo')).toBe(true);
  });
});

describe('projects GET /projects/:id', () => {
  it('returns the project when found', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme repo')!;
    const res = await app.inject({ method: 'GET', url: `/projects/${existing.id}` });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { id: string }).id).toBe(existing.id);
  });

  it('returns 404 when not found', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});

describe('projects PATCH /projects/:id — update', () => {
  it('updates name and tags', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme repo')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${existing.id}`,
      payload: { name: 'Acme renamed', tags: ['a', 'b'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string; tags: string[] };
    expect(body.name).toBe('Acme renamed');
    expect(body.tags).toEqual(['a', 'b']);
  });

  it('archives via status', async () => {
    const existing = [...projects.values()].find((p) => p.name === 'Acme renamed')!;
    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${existing.id}`,
      payload: { status: 'archived' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe('archived');
  });

  it('returns 404 when updating a missing project', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/projects/nonexistent',
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('projects DELETE /projects/:id', () => {
  it('deletes the project (204)', async () => {
    const target = ProjectEntity.create({ userId: 'u1', name: 'Doomed' });
    projects.set(target.id, target);
    const res = await app.inject({ method: 'DELETE', url: `/projects/${target.id}` });
    expect(res.statusCode).toBe(204);
    expect(projects.has(target.id)).toBe(false);
  });

  it('returns 404 when deleting a missing project', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});

describe('projects auth', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const unauthed = Fastify();
    unauthed.decorate('authenticate', realAuthenticate);
    setErrorHandler(unauthed);
    await projectRoutes(unauthed as unknown as AuthFastifyInstance);
    await unauthed.ready();
    const res = await unauthed.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(401);
    await unauthed.close();
  });
});
