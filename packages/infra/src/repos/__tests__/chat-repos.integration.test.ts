import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Agent, ChatSession } from '@wolfkrow/domain';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterAll, describe, expect, it } from 'vitest';

import * as schema from '../../db/schema';
import { DrizzleAgentRepo } from '../agent-repo';
import { DrizzleChatSessionRepo } from '../chat-repos';

function makeAgent(userId: string): Agent {
  return Agent.create({
    userId,
    name: 'Agent',
    description: undefined,
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    thinking: false,
    thinkingBudget: undefined,
    maxTurns: 10,
    allowedTools: [],
    mcpServers: [],
    isActive: true,
    skills: [],
    runtime: 'cloud',
    provider: 'anthropic',
    squad: undefined,
    systemPrompt: '',
  });
}

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../drizzle',
);

function makeDb() {
  const dbPath = path.join(os.tmpdir(), `wolfkrow-chat-fk-test-${Date.now()}.db`);
  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  sqlite.exec(
    `INSERT INTO users (id, password_hash, role, totp_enabled, failed_attempts, created_at, updated_at) VALUES ('user-1', 'x', 'owner', 0, 0, 0, 0)`,
  );
  return { db, dbPath, sqlite };
}

describe('chat_sessions.agent_id FK (integration)', () => {
  let dbPath = '';
  let sqlite: Database.Database;

  afterAll(() => {
    if (sqlite) sqlite.close();
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('persists session without agent_id as NULL', async () => {
    const { db, dbPath: p, sqlite: s } = makeDb();
    dbPath = p;
    sqlite = s;

    const repo = new DrizzleChatSessionRepo(db);
    const session = ChatSession.create({ userId: 'user-1', agentId: undefined, title: 'No agent', archived: false });
    const saved = await repo.save(session);
    expect(saved.id).toBe(session.id);

    const row = sqlite.prepare('SELECT agent_id FROM chat_sessions WHERE id = ?').get(session.id) as { agent_id: null | string };
    expect(row.agent_id).toBeNull();
  });

  it('persists session with agent_id when agent exists', async () => {
    const { db, dbPath: p, sqlite: s } = makeDb();
    dbPath = p;
    sqlite = s;

    const agentRepo = new DrizzleAgentRepo(db);
    const agent = makeAgent('user-1');
    await agentRepo.save(agent);

    const repo = new DrizzleChatSessionRepo(db);
    const session = ChatSession.create({ userId: 'user-1', agentId: agent.id, title: 'With agent', archived: false });
    await repo.save(session);

    const row = sqlite.prepare('SELECT agent_id FROM chat_sessions WHERE id = ?').get(session.id) as { agent_id: null | string };
    expect(row.agent_id).toBe(agent.id);
  });

  it('sets agent_id to NULL when referenced agent is deleted', async () => {
    const { db, dbPath: p, sqlite: s } = makeDb();
    dbPath = p;
    sqlite = s;

    const agentRepo = new DrizzleAgentRepo(db);
    const agent = makeAgent('user-1');
    await agentRepo.save(agent);

    const repo = new DrizzleChatSessionRepo(db);
    const session = ChatSession.create({ userId: 'user-1', agentId: agent.id, title: 'With agent', archived: false });
    await repo.save(session);

    await agentRepo.delete(agent.id);

    const row = sqlite.prepare('SELECT agent_id FROM chat_sessions WHERE id = ?').get(session.id) as { agent_id: null | string };
    expect(row.agent_id).toBeNull();
  });
});
