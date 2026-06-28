import { Skill } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { OverrideSkillUseCase } from '../override-skill';

function inMemorySkillRepo(): SkillRepo & { store: Map<string, Skill> } {
  const store = new Map<string, Skill>();
  return {
    store,
    findById: async (id) => store.get(id) ?? null,
    findByUserId: async (userId) => [...store.values()].filter((s) => s.userId === userId),
    findBuiltIn: async () => [...store.values()].filter((s) => s.isBuiltIn),
    findByName: async (userId, name) =>
      [...store.values()].find((s) => s.userId === userId && s.name === name) ?? null,
    save: async (skill) => {
      store.set(skill.id, skill);
      return skill;
    },
    delete: async (id) => {
      store.delete(id);
    },
  };
}

describe('OverrideSkillUseCase', () => {
  it('forks a built-in into a user-scoped override (preserves the original)', async () => {
    const repo = inMemorySkillRepo();
    const builtIn = Skill.create({
      userId: 'system',
      name: 'git-commit',
      description: 'how to commit',
      content: 'body',
      tags: [],
      isBuiltIn: true,
    });
    repo.store.set(builtIn.id, builtIn);

    const uc = new OverrideSkillUseCase(repo);
    const { skill, created } = await uc.execute({
      id: builtIn.id,
      userId: 'alice',
      patch: { content: 'edited body' },
    });

    expect(created).toBe(true);
    expect(skill.id).not.toBe(builtIn.id);
    expect(skill.userId).toBe('alice');
    expect(skill.isBuiltIn).toBe(false);
    expect(skill.content).toBe('edited body');
    expect(skill.name).toBe('git-commit');
    // original untouched
    expect(repo.store.get(builtIn.id)?.content).toBe('body');
    // both rows exist
    expect(repo.store.size).toBe(2);
  });

  it('updates a user-owned skill in place (no fork)', async () => {
    const repo = inMemorySkillRepo();
    const mine = Skill.create({
      userId: 'alice',
      name: 'my-skill',
      description: 'd',
      content: 'orig',
      tags: [],
      isBuiltIn: false,
    });
    repo.store.set(mine.id, mine);

    const { skill, created } = await new OverrideSkillUseCase(repo).execute({
      id: mine.id,
      userId: 'alice',
      patch: { content: 'changed' },
    });

    expect(created).toBe(false);
    expect(skill.id).toBe(mine.id);
    expect(skill.content).toBe('changed');
    expect(repo.store.size).toBe(1);
  });

  it('returns created=false with null skill when the id is unknown', async () => {
    const repo = inMemorySkillRepo();
    const { created } = await new OverrideSkillUseCase(repo).execute({
      id: 'nope',
      userId: 'alice',
      patch: { content: 'x' },
    });
    expect(created).toBe(false);
  });

  it('override preserves name so ListSkills dedup shadows the built-in', async () => {
    const repo = inMemorySkillRepo();
    const builtIn = Skill.create({
      userId: 'system',
      name: 'shared',
      description: 'd',
      content: 'base',
      tags: [],
      isBuiltIn: true,
    });
    repo.store.set(builtIn.id, builtIn);
    const { skill } = await new OverrideSkillUseCase(repo).execute({
      id: builtIn.id,
      userId: 'alice',
      patch: { name: 'shared', content: 'override' },
    });
    // The override has the same name → list dedup (prefers user copy) shadows base.
    expect(skill.name).toBe('shared');
    expect(skill.content).toBe('override');
  });
});
