/**
 * Skills routes — happy / auth paths.
 *
 * skills.ts calls getRepos().skill via ListSkillsUseCase per-request. Mocking
 * the repo with an in-memory fake (backed by real Skill entities) exercises the
 * real route logic. Auth uses the real-behaving decorator (onRequest) so
 * 401-without-session is a genuine rejection.
 */

import { Skill } from '@wolfkrow/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';

const { skills, fakeSkillRepo } = vi.hoisted(() => {
  const skills = new Map<string, Skill>();
  const fakeSkillRepo = {
    findById: async (id: string) => skills.get(id) ?? null,
    findByUserId: async (userId: string) => [...skills.values()].filter((s) => s.userId === userId),
    findBuiltIn: async () => [...skills.values()].filter((s) => s.isBuiltIn),
    findByName: async () => null,
    save: async (s: Skill) => {
      skills.set(s.id, s);
      return s;
    },
    delete: async (id: string) => {
      skills.delete(id);
    },
  };
  return { skills, fakeSkillRepo };
});

vi.mock('../../container', () => ({ getRepos: () => ({ skill: fakeSkillRepo }) }));

import type { AuthFastifyInstance } from '../../types/fastify';
import { skillsRoutes } from '../skills';

import { realAuthenticate, setErrorHandler } from './helpers/app';

const BEARER = { authorization: 'Bearer test-token' };
let app: FastifyInstance;

beforeAll(async () => {
  skills.clear();
  const seeded = Skill.create({
    userId: 'u1',
    name: 'code-review',
    description: 'Reviews code',
    content: '---\nname: code-review\n---\nReview the code.',
    tags: ['review'],
    isBuiltIn: true,
  });
  skills.set(seeded.id, seeded);

  app = Fastify();
  app.decorate('authenticate', realAuthenticate);
  setErrorHandler(app);
  await skillsRoutes(app as unknown as AuthFastifyInstance);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('skills routes — authentication', () => {
  it('GET / without Bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(401);
  });
});

describe('skills GET / — list', () => {
  it('returns the seeded skill as props', async () => {
    const res = await app.inject({ method: 'GET', url: '/', headers: BEARER });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { skills: { name: string; description: string }[] };
    expect(body.skills.some((s) => s.name === 'code-review')).toBe(true);
  });
});
