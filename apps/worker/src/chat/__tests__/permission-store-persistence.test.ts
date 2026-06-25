import { existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getDb, closeDb } from '@wolfkrow/infra';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  _resetForTesting,
  getDecision,
  hasPendingPermission,
  loadDecisionsFromDb,
  recordDecision,
  requestToolPermission,
  resolveToolPermission,
} from '../permission-store';

/**
 * Persistence + restart + scoping tests for the durable permission store.
 *
 * Uses a real temp SQLite file (the `tool_permissions` table is created
 * directly via DDL so the test is self-contained and does not depend on the
 * drizzle migration generator having run). A "restart" is simulated by
 * resetting the in-memory cache (`_resetForTesting`) and reloading from the
 * DB (`loadDecisionsFromDb`) — exactly what the worker does at boot.
 */
describe('permission-store — durable decisions (P1-7)', () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `wolfkrow-perm-test-${Date.now()}-${Math.random()}.db`);
    process.env.WOLFKROW_DB_PATH = testDbPath;
    // Boot the singleton DB against the temp path, then ensure the table.
    getDb(testDbPath);
    ensureToolPermissionsTable(testDbPath);
    _resetForTesting();
  });

  afterEach(() => {
    _resetForTesting();
    closeDb();
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((p) => {
      if (existsSync(p)) unlinkSync(p);
    });
    delete process.env.WOLFKROW_DB_PATH;
  });

  it('recordDecision then getDecision returns the decision from cache (no restart)', () => {
    recordDecision('user-1', 'agent-1', 'Bash:rm', 'allow');
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBe('allow');
  });

  it('returns null when no decision has been recorded for the triple', () => {
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBeNull();
  });

  // ---- Core acceptance criterion: approve → restart → NOT re-asked ----
  it('survives a restart: decision persisted to DB is restored by loadDecisionsFromDb', () => {
    // 1. User approves a tool.
    recordDecision('user-1', 'agent-1', 'Bash:rm', 'allow');
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBe('allow');

    // 2. Simulate a worker restart: wipe the in-memory cache.
    _resetForTesting();
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBeNull();

    // 3. Startup reload repopulates the cache from the DB.
    loadDecisionsFromDb();
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBe('allow');
  });

  it('survives a restart for a denied decision too', () => {
    recordDecision('user-1', 'agent-1', 'Write', 'deny');
    _resetForTesting();
    loadDecisionsFromDb();
    expect(getDecision('user-1', 'agent-1', 'Write')).toBe('deny');
  });

  it('changing a decision (allow→deny) is reflected after restart', () => {
    recordDecision('user-1', 'agent-1', 'Edit', 'allow');
    recordDecision('user-1', 'agent-1', 'Edit', 'deny');

    _resetForTesting();
    loadDecisionsFromDb();
    expect(getDecision('user-1', 'agent-1', 'Edit')).toBe('deny');
  });

  // ---- Per-user scoping: no cross-user leakage ----
  it('does NOT leak user-1 approval to user-2 (per-user scoping)', () => {
    recordDecision('user-1', 'agent-1', 'Bash:rm', 'allow');
    _resetForTesting();
    loadDecisionsFromDb();

    expect(getDecision('user-2', 'agent-1', 'Bash:rm')).toBeNull();
  });

  it('does NOT leak across agents for the same user', () => {
    recordDecision('user-1', 'agent-1', 'Bash:rm', 'allow');
    _resetForTesting();
    loadDecisionsFromDb();

    expect(getDecision('user-1', 'agent-2', 'Bash:rm')).toBeNull();
  });

  // ---- Integration: resolving a pending request persists the decision ----
  it('resolving a pending request persists the decision (approve → durable allow)', async () => {
    const p = requestToolPermission('call-1', {
      userId: 'user-1',
      agentId: 'agent-1',
      tool: 'Bash:rm',
    });
    expect(hasPendingPermission('call-1')).toBe(true);

    resolveToolPermission('call-1', true);
    expect(await p).toBe(true);

    // The decision is now durable: a restart must restore it.
    _resetForTesting();
    loadDecisionsFromDb();
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBe('allow');
  });

  it('resolving a pending request persists a deny decision', async () => {
    const p = requestToolPermission('call-2', {
      userId: 'user-1',
      agentId: 'agent-1',
      tool: 'Write',
    });
    resolveToolPermission('call-2', false);
    expect(await p).toBe(false);

    _resetForTesting();
    loadDecisionsFromDb();
    expect(getDecision('user-1', 'agent-1', 'Write')).toBe('deny');
  });

  it('loadDecisionsFromDb with an empty DB yields an empty cache (no throw)', () => {
    expect(() => loadDecisionsFromDb()).not.toThrow();
    expect(getDecision('user-1', 'agent-1', 'Bash:rm')).toBeNull();
  });
});

/**
 * Idempotently ensure the tool_permissions table exists in the temp DB. Done
 * via a throwaway better-sqlite3 handle (the singleton is already open via
 * getDb); both point at the same file. Mirrors the table DDL produced by the
 * drizzle schema in packages/infra/src/db/schema/tool-permissions.ts.
 */
function ensureToolPermissionsTable(dbPath: string): void {
  const sqlite = new Database(dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tool_permissions (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      agent_id text NOT NULL,
      tool text NOT NULL,
      decision text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tool_permissions_user_agent_tool_idx
      ON tool_permissions (user_id, agent_id, tool);
    CREATE INDEX IF NOT EXISTS tool_permissions_user_id_idx
      ON tool_permissions (user_id);
  `);
  sqlite.close();
}
