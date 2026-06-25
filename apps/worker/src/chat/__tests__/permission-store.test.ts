import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllPendingPermissions, hasPendingPermission, requestToolPermission, resolveToolPermission } from '../permission-store';

/** Minimal context required by requestToolPermission (park-only tests). */
const ctx = { userId: 'u', agentId: 'a', tool: 't' };

describe('permission-store', () => {
  afterEach(() => {
    clearAllPendingPermissions();
  });

  it('resolves the pending promise when the UI approves', async () => {
    const p = requestToolPermission('call-1', ctx);
    expect(hasPendingPermission('call-1')).toBe(true);
    resolveToolPermission('call-1', true);
    expect(await p).toBe(true);
    expect(hasPendingPermission('call-1')).toBe(false);
  });

  it('resolves false when the UI denies', async () => {
    const p = requestToolPermission('call-2', ctx);
    resolveToolPermission('call-2', false);
    expect(await p).toBe(false);
  });

  it('returns false for an unknown callId', () => {
    expect(resolveToolPermission('unknown', true)).toBe(false);
  });

  it('auto-denies after TTL expires', async () => {
    vi.useFakeTimers();
    const p = requestToolPermission('call-ttl', ctx);
    expect(hasPendingPermission('call-ttl')).toBe(true);
    vi.advanceTimersByTime(5 * 60 * 1_000 + 1);
    expect(hasPendingPermission('call-ttl')).toBe(false);
    expect(await p).toBe(false);
    vi.useRealTimers();
  });

  it('clearAllPendingPermissions drains all pending with denied', async () => {
    const p1 = requestToolPermission('drain-1', ctx);
    const p2 = requestToolPermission('drain-2', ctx);
    clearAllPendingPermissions();
    expect(await p1).toBe(false);
    expect(await p2).toBe(false);
    expect(hasPendingPermission('drain-1')).toBe(false);
    expect(hasPendingPermission('drain-2')).toBe(false);
  });
});
