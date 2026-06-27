import type { UsageRecord, UsageRepo } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { CheckBudgetUseCase, ComputeUsageUseCase } from '../index';

// ── Fake ─────────────────────────────────────────────────────────────────────

class InMemoryUsageRepo implements UsageRepo {
  readonly records: UsageRecord[] = [];
  private seq = 0;

  insert(record: Parameters<UsageRepo['insert']>[0]): void {
    this.records.push({
      id: `r${this.seq++}`,
      userId: record.userId,
      source: record.source,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      cost: record.cost,
      sessionId: record.sessionId,
      agentId: record.agentId,
      runtime: record.runtime ?? 'cloud',
      timestamp: record.timestamp,
    });
  }

  findMany(filter: Parameters<UsageRepo['findMany']>[0]): UsageRecord[] {
    return this.records.filter(
      (r) =>
        r.userId === filter.userId &&
        (!filter.from || r.timestamp >= filter.from) &&
        (!filter.to || r.timestamp <= filter.to) &&
        (!filter.source || r.source === filter.source) &&
        (!filter.agentId || r.agentId === filter.agentId),
    );
  }

  totalCostCents(filter: Parameters<UsageRepo['totalCostCents']>[0]): number {
    return this.records
      .filter(
        (r) =>
          r.userId === filter.userId &&
          (!filter.from || r.timestamp >= filter.from) &&
          (!filter.to || r.timestamp <= filter.to) &&
          (!filter.agentId || r.agentId === filter.agentId),
      )
      .reduce((sum, r) => sum + r.cost, 0);
  }
}

function record(overrides: Partial<UsageRecord> & { userId: string }): UsageRecord {
  return {
    id: overrides.id ?? 'x',
    source: 'chat',
    model: 'gpt-4o',
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 1000, // $10.00
    sessionId: undefined,
    agentId: undefined,
    runtime: 'cloud',
    timestamp: new Date(),
    ...overrides,
  };
}

// ── ComputeUsageUseCase ──────────────────────────────────────────────────────

describe('ComputeUsageUseCase', () => {
  let repo: InMemoryUsageRepo;

  beforeEach(() => {
    repo = new InMemoryUsageRepo();
  });

  it('aggregates token totals and cost across records', () => {
    repo.records.push(
      record({ userId: 'u1', model: 'gpt-4o', cost: 1000 }),
      record({ userId: 'u1', model: 'gpt-4o', cost: 500 }),
    );
    const summary = new ComputeUsageUseCase(repo).execute({ userId: 'u1' });
    expect(summary.totalInputTokens).toBe(200);
    expect(summary.totalOutputTokens).toBe(100);
    expect(summary.totalCostUSD).toBe(15); // 1500 cents = $15
  });

  it('groups cost by model and by source', () => {
    repo.records.push(
      record({ userId: 'u1', model: 'gpt-4o', source: 'chat', cost: 1000 }),
      record({ userId: 'u1', model: 'claude', source: 'agent', cost: 2000 }),
    );
    const summary = new ComputeUsageUseCase(repo).execute({ userId: 'u1' });
    expect(summary.byModel['gpt-4o']?.costUSD).toBe(10);
    expect(summary.byModel['claude']?.costUSD).toBe(20);
    expect(summary.bySource['chat']?.costUSD).toBe(10);
    expect(summary.bySource['agent']?.costUSD).toBe(20);
  });

  it('groups cost by runtime origin (cloud vs local)', () => {
    repo.records.push(
      record({ userId: 'u1', model: 'claude-opus', runtime: 'cloud', cost: 1000 }),
      record({ userId: 'u1', model: 'llama3', runtime: 'local', cost: 200 }),
      record({ userId: 'u1', model: 'qwen', runtime: 'local', cost: 300 }),
    );
    const summary = new ComputeUsageUseCase(repo).execute({ userId: 'u1' });
    expect(summary.byRuntime['cloud']?.costUSD).toBe(10);
    expect(summary.byRuntime['cloud']?.inputTokens).toBe(100);
    expect(summary.byRuntime['local']?.costUSD).toBe(5);
    expect(summary.byRuntime['local']?.outputTokens).toBe(100);
  });

  it('emits byDay as an array sorted by day with input/output/cost', () => {
    const day1 = new Date('2024-01-02T10:00:00Z');
    const day2 = new Date('2024-01-01T10:00:00Z');
    repo.records.push(
      record({ userId: 'u1', inputTokens: 100, outputTokens: 40, cost: 500, timestamp: day1 }),
      record({ userId: 'u1', inputTokens: 50, outputTokens: 10, cost: 250, timestamp: day2 }),
    );
    const summary = new ComputeUsageUseCase(repo).execute({ userId: 'u1' });
    expect(Array.isArray(summary.byDay)).toBe(true);
    expect(summary.byDay).toEqual([
      { day: '2024-01-01', inputTokens: 50, outputTokens: 10, costUSD: 2.5 },
      { day: '2024-01-02', inputTokens: 100, outputTokens: 40, costUSD: 5 },
    ]);
  });

  it('ignores records from other users', () => {
    repo.records.push(record({ userId: 'u1', cost: 1000 }), record({ userId: 'u2', cost: 9999 }));
    const summary = new ComputeUsageUseCase(repo).execute({ userId: 'u1' });
    expect(summary.totalCostUSD).toBe(10);
  });
});

// ── CheckBudgetUseCase ───────────────────────────────────────────────────────

describe('CheckBudgetUseCase', () => {
  let repo: InMemoryUsageRepo;

  beforeEach(() => {
    repo = new InMemoryUsageRepo();
  });

  it('reports not exceeded when spend is under budget', () => {
    repo.records.push(record({ userId: 'u1', cost: 2000 })); // $20
    const result = new CheckBudgetUseCase(repo).execute({ userId: 'u1', budgetUSD: 50 });
    expect(result.exceeded).toBe(false);
    expect(result.spentUSD).toBe(20);
    expect(result.percentUsed).toBe(40);
  });

  it('reports exceeded when spend crosses budget', () => {
    repo.records.push(record({ userId: 'u1', cost: 6000 })); // $60
    const result = new CheckBudgetUseCase(repo).execute({ userId: 'u1', budgetUSD: 50 });
    expect(result.exceeded).toBe(true);
    expect(result.percentUsed).toBe(120);
  });

  it('scopes cost to the agentId filter', () => {
    repo.records.push(
      record({ userId: 'u1', agentId: 'a1', cost: 6000 }),
      record({ userId: 'u1', agentId: 'a2', cost: 1000 }),
    );
    const result = new CheckBudgetUseCase(repo).execute({
      userId: 'u1',
      budgetUSD: 50,
      agentId: 'a1',
    });
    expect(result.spentUSD).toBe(60);
    expect(result.exceeded).toBe(true);
  });
});
