import { existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, getDb, getSqlite, loadVecExtension, resetDb, shouldLoadVec } from '../db/client';
import { runMigrations } from '../db/migrate';
import { users, mcpServers } from '../db/schema';

describe('Database Client', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `wolfkrow-test-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = testDbPath;
  });

  afterEach(() => {
    closeDb();
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((p) => {
      if (existsSync(p)) unlinkSync(p);
    });
    delete process.env.WOLFKROW_DB_PATH;
  });

  describe('getSqlite', () => {
    it('creates database file if missing', () => {
      const sqlite = getSqlite(testDbPath);
      expect(existsSync(testDbPath)).toBe(true);
      expect(sqlite).toBeDefined();
    });

    it('enables WAL mode', () => {
      const sqlite = getSqlite(testDbPath);
      const result = sqlite.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });

    it('enables foreign keys', () => {
      const sqlite = getSqlite(testDbPath);
      const result = sqlite.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });

    it('returns same instance (singleton)', () => {
      const a = getSqlite(testDbPath);
      const b = getSqlite(testDbPath);
      expect(a).toBe(b);
    });
  });

  describe('getDb', () => {
    it('returns Drizzle ORM client', () => {
      const db = getDb(testDbPath);
      expect(db).toBeDefined();
      expect(typeof db.select).toBe('function');
      expect(typeof db.insert).toBe('function');
    });

    it('returns same instance (singleton)', () => {
      const a = getDb(testDbPath);
      const b = getDb(testDbPath);
      expect(a).toBe(b);
    });
  });

  describe('closeDb', () => {
    it('closes the connection and resets singleton', () => {
      getDb(testDbPath);
      closeDb();
      const db = getDb(testDbPath);
      expect(db).toBeDefined();
    });
  });

  describe('resetDb', () => {
    it('deletes the database file', () => {
      getDb(testDbPath);
      resetDb(testDbPath);
      expect(existsSync(testDbPath)).toBe(false);
    });
  });
});

describe('Schema basic operations (without migrations)', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `wolfkrow-test-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = testDbPath;
  });

  afterEach(() => {
    closeDb();
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((p) => {
      if (existsSync(p)) unlinkSync(p);
    });
    delete process.env.WOLFKROW_DB_PATH;
  });

  it('migrations folder validation throws helpful error', () => {
    expect(() =>
      runMigrations({ migrationsFolder: '/nonexistent/path', dbPath: testDbPath })
    ).toThrow(/Run "pnpm db:generate" first/);
  });

  it('schema exports are correct', () => {
    expect(users).toBeDefined();
    expect(mcpServers).toBeDefined();
    expect(users.id.name).toBe('id');
    expect(users.email.name).toBe('email');
    expect(mcpServers.name.name).toBe('name');
  });
});

describe('sqlite-vec loading (FIX-020 fail-fast)', () => {
  const originalFlag = process.env.WOLFKROW_DISABLE_VEC;
  const originalDbPath = process.env.WOLFKROW_DB_PATH;

  beforeEach(() => {
    delete process.env.WOLFKROW_DISABLE_VEC;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.WOLFKROW_DISABLE_VEC;
    else process.env.WOLFKROW_DISABLE_VEC = originalFlag;
    if (originalDbPath === undefined) delete process.env.WOLFKROW_DB_PATH;
    else process.env.WOLFKROW_DB_PATH = originalDbPath;
    closeDb();
  });

  it('shouldLoadVec is true by default', () => {
    expect(shouldLoadVec()).toBe(true);
  });

  it('shouldLoadVec is false when WOLFKROW_DISABLE_VEC=1', () => {
    process.env.WOLFKROW_DISABLE_VEC = '1';
    expect(shouldLoadVec()).toBe(false);
  });

  it('loadVecExtension throws descriptive error when loadExtension fails', () => {
    const failingDb = { loadExtension: () => { throw new Error('ENOENT: missing vec'); } };
    expect(() => loadVecExtension(failingDb, '/fake/vec.node')).toThrow(/sqlite-vec/);
    expect(() => loadVecExtension(failingDb, '/fake/vec.node')).toThrow(/WOLFKROW_DISABLE_VEC/);
  });

  it('loadVecExtension is a no-op when vec disabled (does not call loadExtension)', () => {
    process.env.WOLFKROW_DISABLE_VEC = '1';
    const loadExtension = vi.fn();
    const fakeDb = { loadExtension };
    expect(() => loadVecExtension(fakeDb, '/fake/vec.node')).not.toThrow();
    expect(loadExtension).not.toHaveBeenCalled();
  });
});
