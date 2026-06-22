import type { DailySummary, DailySummaryRepo } from '@wolfkrow/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DreamingGate } from '../gate';

function fakeSummaryRepo(): { saved: DailySummary[] } & DailySummaryRepo {
  const saved: DailySummary[] = [];
  return {
    saved,
    findByUserIdAndDate: async () => null,
    findByUserId: async () => saved,
    save: async (s) => {
      saved.push(s);
      return s;
    },
  };
}

describe('DreamingGate (FIX-013)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('generates a daily summary after the idle threshold elapses', async () => {
    const repo = fakeSummaryRepo();
    const gate = new DreamingGate(repo, { userId: 'u1', idleThresholdMs: 5_000 });

    gate.start();
    await vi.advanceTimersByTimeAsync(5_001);

    expect(repo.saved).toHaveLength(1);
    gate.stop();
  });

  it('does not fire while activity keeps resetting the timer', async () => {
    const repo = fakeSummaryRepo();
    const gate = new DreamingGate(repo, { userId: 'u1', idleThresholdMs: 5_000 });

    gate.start();
    await vi.advanceTimersByTimeAsync(3_000);
    gate.recordActivity();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(repo.saved).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(repo.saved).toHaveLength(1);
    gate.stop();
  });

  it('stop() cancels the pending timer', async () => {
    const repo = fakeSummaryRepo();
    const gate = new DreamingGate(repo, { userId: 'u1', idleThresholdMs: 5_000 });

    gate.start();
    gate.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(repo.saved).toHaveLength(0);
  });
});
