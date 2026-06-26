/**
 * Tests: EPIC 0.2 — ensureBuiltInSkills idempotent seeder.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRepo, mockSkill, mockLoaded } = vi.hoisted(() => ({
  mockRepo: {
    findBuiltIn: vi.fn(),
    save: vi.fn(),
  },
  mockSkill: {
    fromProps: vi.fn(),
  },
  mockLoaded: [
    { skill: { toProps: () => ({ name: 'skill-a', content: 'a' }) } },
    { skill: { toProps: () => ({ name: 'skill-b', content: 'b' }) } },
  ],
}));

vi.mock('@wolfkrow/domain', () => ({ Skill: mockSkill }));
vi.mock('@wolfkrow/infra/seed/skill-loader', () => ({
  loadBuiltInSkills: vi.fn().mockResolvedValue(mockLoaded),
}));

import { ensureBuiltInSkills } from '../skills-seeder';

describe('ensureBuiltInSkills', () => {
  beforeEach(() => {
    mockRepo.findBuiltIn.mockReset();
    mockRepo.save.mockReset();
    mockSkill.fromProps.mockReset();
    mockSkill.fromProps.mockImplementation((props: { name: string }) => ({ id: `owned-${props.name}` }));
  });

  it('returns 0 and skips writes when built-in skills already exist', async () => {
    mockRepo.findBuiltIn.mockResolvedValue([{ id: 'existing' }]);

    const inserted = await ensureBuiltInSkills(mockRepo as never, 'u1');

    expect(inserted).toBe(0);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('seeds every loaded skill marked isBuiltIn for the owner when none exist', async () => {
    mockRepo.findBuiltIn.mockResolvedValue([]);

    const inserted = await ensureBuiltInSkills(mockRepo as never, 'owner-1');

    expect(inserted).toBe(mockLoaded.length);
    expect(mockRepo.save).toHaveBeenCalledTimes(mockLoaded.length);
    for (const call of mockSkill.fromProps.mock.calls) {
      expect(call[0]).toMatchObject({ userId: 'owner-1', isBuiltIn: true });
    }
  });

  it('is idempotent across calls once skills exist', async () => {
    mockRepo.findBuiltIn.mockResolvedValue([]);

    await ensureBuiltInSkills(mockRepo as never, 'u1');
    expect(mockRepo.save).toHaveBeenCalledTimes(mockLoaded.length);

    // Second invocation: DB now reports built-ins present → no further writes.
    mockRepo.findBuiltIn.mockResolvedValue([{ id: 'seeded' }]);
    mockRepo.save.mockClear();
    const second = await ensureBuiltInSkills(mockRepo as never, 'u1');

    expect(second).toBe(0);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
