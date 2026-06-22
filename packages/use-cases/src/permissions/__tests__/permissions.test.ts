import type { AuditRow, AuditRepo } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import { QueryAuditLogUseCase, RecordAuditEntryUseCase } from '../index';

// ── Fake ─────────────────────────────────────────────────────────────────────

class InMemoryAuditRepo implements AuditRepo {
  readonly rows: AuditRow[] = [];
  private seq = 0;

  insert(entry: Parameters<AuditRepo['insert']>[0]): void {
    this.rows.push({
      id: `a${this.seq++}`,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata,
      ip: entry.ip,
      timestamp: entry.timestamp,
    });
  }

  findMany(filter: Parameters<AuditRepo['findMany']>[0]): AuditRow[] {
    return this.rows
      .filter(
        (r) =>
          r.userId === filter.userId &&
          (!filter.action || r.action === filter.action) &&
          (!filter.resourceType || r.resourceType === filter.resourceType) &&
          (!filter.since || r.timestamp >= filter.since),
      )
      .slice(0, filter.limit ?? 200);
  }
}

// ── RecordAuditEntryUseCase ──────────────────────────────────────────────────

describe('RecordAuditEntryUseCase', () => {
  let repo: InMemoryAuditRepo;

  beforeEach(() => {
    repo = new InMemoryAuditRepo();
  });

  it('inserts an entry with a generated timestamp', () => {
    const before = Date.now();
    new RecordAuditEntryUseCase(repo).execute({
      userId: 'u1',
      action: 'agent.create',
      resourceType: 'agent',
      resourceId: 'a1',
      metadata: { model: 'gpt-4o' },
    });
    const entry = repo.rows[0];
    expect(entry).toBeDefined();
    expect(entry.userId).toBe('u1');
    expect(entry.action).toBe('agent.create');
    expect(entry.resourceId).toBe('a1');
    expect(entry.metadata).toEqual({ model: 'gpt-4o' });
    expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('defaults metadata to empty object when omitted', () => {
    new RecordAuditEntryUseCase(repo).execute({
      userId: 'u1',
      action: 'skill.delete',
      resourceType: 'skill',
    });
    expect(repo.rows[0]?.metadata).toEqual({});
  });
});

// ── QueryAuditLogUseCase ─────────────────────────────────────────────────────

describe('QueryAuditLogUseCase', () => {
  let repo: InMemoryAuditRepo;

  beforeEach(() => {
    repo = new InMemoryAuditRepo();
  });

  it('returns only rows matching the action filter', () => {
    repo.rows.push(
      { id: '1', userId: 'u1', action: 'agent.create', resourceType: 'agent', resourceId: undefined, metadata: {}, ip: undefined, timestamp: new Date() },
      { id: '2', userId: 'u1', action: 'skill.delete', resourceType: 'skill', resourceId: undefined, metadata: {}, ip: undefined, timestamp: new Date() },
    );
    const result = new QueryAuditLogUseCase(repo).execute({ userId: 'u1', action: 'agent.create' });
    expect(result).toHaveLength(1);
    expect(result[0]?.action).toBe('agent.create');
  });

  it('limits the number of returned rows', () => {
    for (let i = 0; i < 5; i++) {
      repo.rows.push({ id: String(i), userId: 'u1', action: 'agent.create', resourceType: 'agent', resourceId: undefined, metadata: {}, ip: undefined, timestamp: new Date() });
    }
    const result = new QueryAuditLogUseCase(repo).execute({ userId: 'u1', limit: 2 });
    expect(result).toHaveLength(2);
  });
});
