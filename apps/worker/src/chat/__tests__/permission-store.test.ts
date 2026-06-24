import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllPendingPermissions, hasPendingPermission, requestToolPermission, resolveToolPermission } from '../permission-store';

describe('permission-store', () => {
  afterEach(() => {
    clearAllPendingPermissions();
  });

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

  it('auto-denies after TTL expires', async () => {
    vi.useFakeTimers();
    const p = requestToolPermission('call-ttl');
    expect(hasPendingPermission('call-ttl')).toBe(true);
    vi.advanceTimersByTime(5 * 60 * 1_000 + 1);
    expect(hasPendingPermission('call-ttl')).toBe(false);
    expect(await p).toBe(false);
    vi.useRealTimers();
  });

  it('clearAllPendingPermissions drains all pending with denied', async () => {
    const p1 = requestToolPermission('drain-1');
    const p2 = requestToolPermission('drain-2');
    clearAllPendingPermissions();
    expect(await p1).toBe(false);
    expect(await p2).toBe(false);
    expect(hasPendingPermission('drain-1')).toBe(false);
    expect(hasPendingPermission('drain-2')).toBe(false);
  });
});
