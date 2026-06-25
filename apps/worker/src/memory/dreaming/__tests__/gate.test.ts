import type { CompactionLog, CompactionLogRepo, DailySummary, DailySummaryRepo } from '@wolfkrow/domain';
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

function fakeCompactionRepo(): { saved: CompactionLog[] } & CompactionLogRepo {
  const saved: CompactionLog[] = [];
  return {
    saved,
    findByUserId: async () => saved,
    save: async (l) => {
      saved.push(l);
      return l;
    },
  };
}

describe('DreamingGate (FIX-013)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('generates a daily summary after the idle threshold elapses', async () => {
    const repo = fakeSummaryRepo();
    const compaction = fakeCompactionRepo();
    const gate = new DreamingGate(repo, compaction, { userId: 'u1', idleThresholdMs: 5_000 });

    gate.start();
    await vi.advanceTimersByTimeAsync(5_001);

    expect(repo.saved).toHaveLength(1);
    expect(compaction.saved).toHaveLength(1);
    expect(compaction.saved[0]?.trigger).toBe('idle');
    gate.stop();
  });

  it('does not fire while activity keeps resetting the timer', async () => {
    const repo = fakeSummaryRepo();
    const gate = new DreamingGate(repo, fakeCompactionRepo(), { userId: 'u1', idleThresholdMs: 5_000 });

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
    const gate = new DreamingGate(repo, fakeCompactionRepo(), { userId: 'u1', idleThresholdMs: 5_000 });

    gate.start();
    gate.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(repo.saved).toHaveLength(0);
  });

  it('getStatus reports active while started and idle after stop', () => {
    const gate = new DreamingGate(fakeSummaryRepo(), fakeCompactionRepo(), { userId: 'u1', idleThresholdMs: 5_000 });

    expect(gate.getStatus().active).toBe(false);
    gate.start();
    expect(gate.getStatus().active).toBe(true);
    expect(gate.getStatus().idleThresholdMs).toBe(5_000);
    gate.stop();
    expect(gate.getStatus().active).toBe(false);
  });

  it('triggerNow consolidates immediately with a manual compaction log', async () => {
    const repo = fakeSummaryRepo();
    const compaction = fakeCompactionRepo();
    const gate = new DreamingGate(repo, compaction, { userId: 'u1', idleThresholdMs: 5_000 });

    await gate.triggerNow();

    expect(repo.saved).toHaveLength(1);
    expect(compaction.saved).toHaveLength(1);
    expect(compaction.saved[0]?.trigger).toBe('manual');
  });
});
