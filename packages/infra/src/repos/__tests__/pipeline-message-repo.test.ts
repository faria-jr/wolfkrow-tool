/**
 * Tests: R7 — DrizzlePipelineMessageRepo (unit, mocked DB per mock-only-repository-tests rule).
 */

import { PipelineMessage } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import { DrizzlePipelineMessageRepo } from '../pipeline-message-repo';

/** Builds a chainable mock matching the drizzle insert/select fluent API. */
function makeMockDb(rows: unknown[] = []) {
  const insertChain = {
    values: vi.fn(function (this: unknown, _values: unknown) { return this; }),
    onConflictDoUpdate: vi.fn(function (this: unknown) { return this; }),
    run: vi.fn(),
  };
  const selectChain = {
    from: vi.fn(function (this: unknown) { return this; }),
    where: vi.fn(function (this: unknown) { return this; }),
    all: vi.fn(() => rows),
  };
  type Tx = { insert: (_table: unknown) => typeof txInsert };
  const txInsert = {
    values: vi.fn(function (this: unknown) { return this; }),
    onConflictDoUpdate: vi.fn(function (this: unknown) { return this; }),
    run: vi.fn(),
  };
  const tx: Tx = { insert: vi.fn((_table: unknown) => txInsert) };
  const db = {
    insert: vi.fn(() => insertChain),
    select: vi.fn(() => selectChain),
    transaction: vi.fn((cb: (t: Tx) => void) => cb(tx)),
  };
  return { db, insertChain, selectChain, txInsert, tx };
}

describe('DrizzlePipelineMessageRepo', () => {
  it('save inserts a row with mapped props and returns the message', async () => {
    const { db, insertChain } = makeMockDb();
    const repo = new DrizzlePipelineMessageRepo(db as never);
    const msg = PipelineMessage.create({ projectId: 'p1', phaseId: 'ph1', role: 'user', content: 'hi' });

    const result = await repo.save(msg);

    expect(result).toBe(msg);
    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesArg = insertChain.values.mock.calls[0]?.[0];
    expect(valuesArg).toMatchObject({ projectId: 'p1', phaseId: 'ph1', role: 'user', content: 'hi' });
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(insertChain.run).toHaveBeenCalledTimes(1);
  });

  it('saveMany runs a single transaction with one insert per message', async () => {
    const { db, tx, txInsert } = makeMockDb();
    const repo = new DrizzlePipelineMessageRepo(db as never);
    const msgs = [
      PipelineMessage.create({ projectId: 'p1', phaseId: 'ph1', role: 'user', content: 'q' }),
      PipelineMessage.create({ projectId: 'p1', phaseId: 'ph1', role: 'assistant', content: 'a' }),
    ];

    await repo.saveMany(msgs);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(txInsert.values).toHaveBeenCalledTimes(2);
    expect(txInsert.run).toHaveBeenCalledTimes(2);
  });

  it('saveMany is a no-op for an empty batch', async () => {
    const { db } = makeMockDb();
    const repo = new DrizzlePipelineMessageRepo(db as never);
    await repo.saveMany([]);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('findByPhaseId maps DB rows to PipelineMessage entities', async () => {
    const createdAt = new Date('2026-06-23T10:00:00.000Z');
    const { db } = makeMockDb([
      { id: 'm1', projectId: 'p1', phaseId: 'ph1', role: 'assistant', content: 'out', createdAt },
    ]);
    const repo = new DrizzlePipelineMessageRepo(db as never);

    const result = await repo.findByPhaseId('ph1');

    expect(result).toHaveLength(1);
    expect(result[0]?.toProps()).toMatchObject({ id: 'm1', role: 'assistant', content: 'out', phaseId: 'ph1' });
  });
});
