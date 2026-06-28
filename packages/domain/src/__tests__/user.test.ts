import { describe, expect, it } from 'vitest';

import { LockoutPolicy, PasswordHash, User, type UserProps } from '../index';

const hash = PasswordHash.create(`$2b$12$${'a'.repeat(53)}`);

const baseProps: UserProps = {
  id: 'u1',
  passwordHash: hash,
  email: undefined,
  displayName: undefined,
  role: undefined,
  totpEnabled: undefined,
  totpSecret: undefined,
  failedAttempts: undefined,
  lockedUntil: undefined,
  lastLogin: undefined,
};

function makeUser(overrides: Partial<UserProps> = {}): User {
  return User.fromProps({ ...baseProps, ...overrides });
}

describe('User', () => {
  it('fromProps → toProps roundtrip with defaults', () => {
    const u = makeUser({ displayName: 'Wolf' });
    expect(u.toProps()).toMatchObject({
      id: 'u1',
      displayName: 'Wolf',
      role: 'owner',
      failedAttempts: 0,
    });
  });

  it('isLocked true when lockedUntil is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(makeUser({ lockedUntil: future }).isLocked()).toBe(true);
  });

  it('isLocked false when lockedUntil is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(makeUser({ lockedUntil: past }).isLocked()).toBe(false);
  });

  it('isLocked false when never locked', () => {
    expect(makeUser().isLocked()).toBe(false);
  });

  it('recordFailedAttempt increments and locks at max', () => {
    const policy = new LockoutPolicy(3, 60_000);
    let u = makeUser();
    u = u.recordFailedAttempt(policy);
    u = u.recordFailedAttempt(policy);
    expect(u.failedAttempts).toBe(2);
    expect(u.lockedUntil).toBeUndefined();

    u = u.recordFailedAttempt(policy);
    expect(u.failedAttempts).toBe(3);
    expect(u.lockedUntil).toBeDefined();
  });

  it('recordSuccessfulLogin resets attempts and stamps lastLogin', () => {
    const u = makeUser({ failedAttempts: 3 }).recordSuccessfulLogin();
    expect(u.failedAttempts).toBe(0);
    expect(u.lastLogin).toBeDefined();
  });

  it('enableTotp/disableTotp toggle', () => {
    const enabled = makeUser().enableTotp('SECRET');
    expect(enabled.totpEnabled).toBe(true);
    expect(enabled.totpSecret).toBe('SECRET');
    expect(enabled.disableTotp().totpEnabled).toBe(false);
  });

  it('mutations return a new instance (immutable)', () => {
    const u = makeUser();
    const u2 = u.recordSuccessfulLogin();
    expect(u.lastLogin).toBeUndefined();
    expect(u2).not.toBe(u);
  });
});
