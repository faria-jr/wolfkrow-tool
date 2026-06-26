/**
 * Tests: EPIC 0.2 — ensureBuiltInRules idempotent seeder.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRepo, mockGlobalRule } = vi.hoisted(() => ({
  mockRepo: {
    findAll: vi.fn(),
    save: vi.fn(),
  },
  mockGlobalRule: {
    create: vi.fn(),
  },
}));

vi.mock('@wolfkrow/domain', () => ({ GlobalRule: mockGlobalRule }));

import { ensureBuiltInRules } from '../rules-seeder';

describe('ensureBuiltInRules', () => {
  beforeEach(() => {
    mockRepo.findAll.mockReset();
    mockRepo.save.mockReset();
    mockGlobalRule.create.mockReset();
    mockGlobalRule.create.mockImplementation((input: { title: string }) => ({ id: `rule-${input.title}` }));
  });

  it('returns 0 and skips writes when the user already has rules', async () => {
    mockRepo.findAll.mockResolvedValue([{ id: 'existing' }]);

    const inserted = await ensureBuiltInRules(mockRepo as never, 'u1');

    expect(inserted).toBe(0);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('seeds the default behavior/soul/user rules when none exist', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    const inserted = await ensureBuiltInRules(mockRepo as never, 'owner-1');

    expect(inserted).toBe(3);
    expect(mockRepo.save).toHaveBeenCalledTimes(3);
    const kinds = mockGlobalRule.create.mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(['behavior', 'soul', 'user']);
    for (const call of mockGlobalRule.create.mock.calls) {
      expect(call[0]).toMatchObject({ userId: 'owner-1', enabled: true });
    }
  });

  it('is idempotent once rules exist', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    await ensureBuiltInRules(mockRepo as never, 'u1');
    expect(mockRepo.save).toHaveBeenCalledTimes(3);

    mockRepo.findAll.mockResolvedValue([{ id: 'r1' }]);
    mockRepo.save.mockClear();
    const second = await ensureBuiltInRules(mockRepo as never, 'u1');

    expect(second).toBe(0);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
