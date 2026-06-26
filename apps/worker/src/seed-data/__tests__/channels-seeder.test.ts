/**
 * Tests: EPIC 0.2 — ensureBuiltInChannels idempotent seeder.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  __run: ReturnType<typeof vi.fn>;
  __all: ReturnType<typeof vi.fn>;
  __values: ReturnType<typeof vi.fn>;
}

function makeFakeDb(existing: unknown[]): FakeDb {
  const run = vi.fn();
  const all = vi.fn(() => existing);
  const values = vi.fn(() => ({ run }));
  const whereRet = { all };
  const fromRet = { where: vi.fn(() => whereRet) };
  const select = vi.fn(() => ({ from: vi.fn(() => fromRet) }));
  const insert = vi.fn(() => ({ values }));
  return { select, insert, __run: run, __all: all, __values: values };
}

const { mockGetDb, current } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  current: { value: null as FakeDb | null },
}));

vi.mock('@wolfkrow/infra/db/client', () => ({ getDb: mockGetDb }));

import { ensureBuiltInChannels } from '../channels-seeder';

describe('ensureBuiltInChannels', () => {
  beforeEach(() => {
    mockGetDb.mockReset();
    current.value = null;
  });

  it('seeds 4 channel placeholders (telegram/discord/slack/whatsapp) when none exist', async () => {
    const db = makeFakeDb([]);
    current.value = db;
    mockGetDb.mockImplementation(() => db);

    const inserted = await ensureBuiltInChannels('owner-1');

    expect(inserted).toBe(4);
    expect(db.insert).toHaveBeenCalledTimes(4);
    expect(db.__run).toHaveBeenCalledTimes(4);
    const names = db.__values.mock.calls.map((c) => (c[0] as { name: string }).name);
    expect(names).toEqual(['Telegram', 'Discord', 'Slack', 'Whatsapp']);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and skips inserts when channels already exist for the user', async () => {
    const db = makeFakeDb([{ id: 'c1', type: 'telegram' }]);
    mockGetDb.mockImplementation(() => db);

    const inserted = await ensureBuiltInChannels('owner-1');

    expect(inserted).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
