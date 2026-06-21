import { describe, expect, it } from 'vitest';

import { LockoutPolicy } from '../index';

describe('LockoutPolicy', () => {
  it('shouldLock false below max, true at/above max', () => {
    const policy = new LockoutPolicy(5);
    expect(policy.shouldLock(4)).toBe(false);
    expect(policy.shouldLock(5)).toBe(true);
    expect(policy.shouldLock(6)).toBe(true);
  });

  it('lockUntil is now + lockDurationMs (ISO)', () => {
    const policy = new LockoutPolicy(5, 60_000);
    const now = new Date('2026-06-20T10:00:00.000Z');
    expect(policy.lockUntil(now)).toBe('2026-06-20T10:01:00.000Z');
  });

  it('uses sensible defaults', () => {
    const policy = new LockoutPolicy();
    expect(policy.maxAttempts).toBe(5);
    expect(policy.lockDurationMs).toBe(5 * 60 * 1000);
  });
});
