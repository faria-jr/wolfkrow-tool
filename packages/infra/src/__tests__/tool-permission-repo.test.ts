import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import * as schema from '../db/schema';
import { toolPermissions } from '../db/schema';
import { DrizzleToolPermissionRepo, decisionKey } from '../repos/tool-permission-repo';

/**
 * Isolated in-memory SQLite — only the tool_permissions table is needed.
 * Follows the same pattern as apps/worker graph.test.ts (no migration runner,
 * no file on disk, FKs off by default so we can use arbitrary user/agent ids).
 * The db is constructed WITH the schema so its type matches the repo's Db.
 */
function makeDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE tool_permissions (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      agent_id text NOT NULL,
      tool text NOT NULL,
      decision text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE UNIQUE INDEX tool_permissions_user_agent_tool_idx
      ON tool_permissions (user_id, agent_id, tool);
    CREATE INDEX tool_permissions_user_id_idx ON tool_permissions (user_id);
  `);
  return drizzle(sqlite, { schema });
}

describe('DrizzleToolPermissionRepo', () => {
  let db: ReturnType<typeof makeDb>;
  let repo: DrizzleToolPermissionRepo;

  beforeAll(() => {
    db = makeDb();
  });

  beforeEach(() => {
    db.delete(toolPermissions).run();
    repo = new DrizzleToolPermissionRepo(db);
  });

  it('upserts a new decision and reads it back via findDecision', () => {
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Bash:rm', decision: 'allow' });
    expect(repo.findDecision('u1', 'a1', 'Bash:rm')).toBe('allow');
  });

  it('returns null when no decision exists for the triple', () => {
    expect(repo.findDecision('u1', 'a1', 'Bash:rm')).toBeNull();
  });

  it('upsert is idempotent — same decision twice yields a single row', () => {
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Write', decision: 'allow' });
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Write', decision: 'allow' });

    const rows = db.select().from(toolPermissions).all();
    expect(rows).toHaveLength(1);
  });

  it('changing a decision (allow→deny) updates the existing row, no duplicate', () => {
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Edit', decision: 'allow' });
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Edit', decision: 'deny' });

    expect(repo.findDecision('u1', 'a1', 'Edit')).toBe('deny');
    const rows = db.select().from(toolPermissions).all();
    expect(rows).toHaveLength(1);
  });

  it('does NOT leak decisions across users (per-user scoping)', () => {
    repo.upsert({ userId: 'user-1', agentId: 'a1', tool: 'Bash:rm', decision: 'allow' });
    // user-2 must not see user-1's approval
    expect(repo.findDecision('user-2', 'a1', 'Bash:rm')).toBeNull();
  });

  it('does NOT leak decisions across agents for the same user', () => {
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Bash:rm', decision: 'allow' });
    expect(repo.findDecision('u1', 'a2', 'Bash:rm')).toBeNull();
  });

  it('loadAll returns every decision keyed by decisionKey', () => {
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Bash:rm', decision: 'allow' });
    repo.upsert({ userId: 'u1', agentId: 'a1', tool: 'Write', decision: 'deny' });
    repo.upsert({ userId: 'u2', agentId: 'a1', tool: 'Edit', decision: 'allow' });

    const all = repo.loadAll();
    expect(all.size).toBe(3);
    expect(all.get(decisionKey('u1', 'a1', 'Bash:rm'))).toBe('allow');
    expect(all.get(decisionKey('u1', 'a1', 'Write'))).toBe('deny');
    expect(all.get(decisionKey('u2', 'a1', 'Edit'))).toBe('allow');
  });

  it('decisionKey is collision-resistant for values containing the delimiter', () => {
    // Two distinct triples that would collide with a naive `${a}|${b}|${c}` key.
    const k1 = decisionKey('u|a', 'b', 'c');
    const k2 = decisionKey('u', 'a|b', 'c');
    expect(k1).not.toBe(k2);
  });
});
