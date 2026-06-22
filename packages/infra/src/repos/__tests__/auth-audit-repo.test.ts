import { describe, expect, it } from 'vitest';

import { DrizzleAuthAuditRepo } from '../auth-audit-repo';

import { mockDb } from './mock-db';

describe('DrizzleAuthAuditRepo (FIX-027)', () => {
  it('log() inserts a row with generated id and timestamp', () => {
    const { db, chain } = mockDb();
    const repo = new DrizzleAuthAuditRepo(db as never);

    repo.log({ userId: 'u1', action: 'login.success', ip: '1.2.3.4', userAgent: 'curl' });

    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('log() tolerates undefined userId/ip/userAgent', () => {
    const { db, chain } = mockDb();
    const repo = new DrizzleAuthAuditRepo(db as never);

    expect(() =>
      repo.log({ userId: undefined, action: 'login.fail', ip: undefined, userAgent: undefined }),
    ).not.toThrow();
    expect(chain.run).toHaveBeenCalledTimes(1);
  });
});
