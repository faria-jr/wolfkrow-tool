import { describe, expect, it } from 'vitest';

import { hasPendingPermission, requestToolPermission, resolveToolPermission } from '../permission-store';

describe('permission-store', () => {
  it('resolves the pending promise when the UI approves', async () => {
    const p = requestToolPermission('call-1');
    expect(hasPendingPermission('call-1')).toBe(true);
    resolveToolPermission('call-1', true);
    expect(await p).toBe(true);
    expect(hasPendingPermission('call-1')).toBe(false);
  });

  it('resolves false when the UI denies', async () => {
    const p = requestToolPermission('call-2');
    resolveToolPermission('call-2', false);
    expect(await p).toBe(false);
  });

  it('returns false for an unknown callId', () => {
    expect(resolveToolPermission('unknown', true)).toBe(false);
  });
});
