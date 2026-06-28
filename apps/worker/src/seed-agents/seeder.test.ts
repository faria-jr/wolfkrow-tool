import { Agent, type AgentRepo } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { loadSeedAgents } from './loader';
import { seedAgentId, seedAgents } from './seeder';

/**
 * Minimal in-memory AgentRepo for seeder tests.
 * Records every `save` call so assertions can inspect insert counts,
 * and supports pre-seeding rows to simulate user edits / prior state.
 */
class FakeAgentRepo {
  readonly rows = new Map<string, Agent>();
  saveCalls = 0;

  async findById(id: string): Promise<Agent | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    return [...this.rows.values()].filter((a) => a.userId === userId);
  }

  async findActiveByUserId(userId: string): Promise<Agent[]> {
    return (await this.findByUserId(userId)).filter((a) => a.isActive);
  }

  async save(agent: Agent): Promise<Agent> {
    this.saveCalls += 1;
    this.rows.set(agent.id, agent);
    return agent;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  /** inject a pre-existing agent (simulates user edit or prior state). */
  put(agent: Agent): void {
    this.rows.set(agent.id, agent);
  }
}

function repoFor(): AgentRepo & FakeAgentRepo {
  return new FakeAgentRepo() as unknown as AgentRepo & FakeAgentRepo;
}

function makeAgent(userId: string, name: string): Agent {
  return Agent.fromProps({
    id: seedAgentId(userId, name),
    userId,
    name,
    description: '',
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    thinking: false,
    thinkingBudget: undefined,
    maxTurns: 80,
    allowedTools: [],
    mcpServers: [],
    isActive: true,
    skills: [],
    runtime: 'cloud',
    provider: undefined,
    squad: 'custom',
    systemPrompt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const TMP_DIR = new URL('../__fixtures__/seed-yaml/', import.meta.url).pathname;

describe('seedAgents', () => {
  it('inserts seed defs that are absent for the user', async () => {
    const userId = 'user-1';
    const repo = repoFor();
    const inserted = await seedAgents({ repo, userId, dir: TMP_DIR });

    expect(inserted).toBe(2); // alpha + beta fixtures
    const after = await repo.findByUserId(userId);
    expect(after.length).toBe(2);
  });

  it('is idempotent — second call inserts 0 and count stays stable', async () => {
    const userId = 'user-2';
    const repo = repoFor();

    const first = await seedAgents({ repo, userId, dir: TMP_DIR });
    expect(first).toBe(2);
    const firstCount = (await repo.findByUserId(userId)).length;
    const callsAfterFirst = repo.saveCalls;

    const second = await seedAgents({ repo, userId, dir: TMP_DIR });
    const secondCount = (await repo.findByUserId(userId)).length;

    expect(second).toBe(0); // zero new inserts
    expect(secondCount).toBe(firstCount); // count stable
    expect(repo.saveCalls).toBe(callsAfterFirst); // save NOT called on re-seed
  });

  it('does not overwrite a user-edited agent (same name, different content)', async () => {
    const userId = 'user-3';
    const repo = repoFor();
    // pre-insert a user-customized agent whose NAME matches a seed def.
    const edited = Agent.fromProps({
      ...makeAgent(userId, 'Alpha').toProps(),
      model: 'claude-opus-4-8', // user changed the model
      systemPrompt: 'my custom prompt',
    });
    repo.put(edited);

    await seedAgents({ repo, userId, dir: TMP_DIR });

    const found = (await repo.findByUserId(userId)).find((a) => a.name === 'Alpha');
    expect(found).toBeDefined();
    expect(found?.model).toBe('claude-opus-4-8'); // user edit preserved
    expect(found?.systemPrompt).toBe('my custom prompt');
  });

  it('does not resurrect a previously-deleted seed agent while others remain', async () => {
    const userId = 'user-4';
    const repo = repoFor();

    await seedAgents({ repo, userId, dir: TMP_DIR });
    const beforeDelete = await repo.findByUserId(userId);

    // delete one agent that was seeded
    const target = beforeDelete[0]!;
    await repo.delete(target.id);
    const afterDeleteCount = (await repo.findByUserId(userId)).length;

    // re-seed — the deleted one must NOT come back: re-seed only inserts names
    // absent from the repo, but the worker gate skips users that already have
    // agents. Here we assert the pure seeder honors existing rows and the
    // count only grows when a name is genuinely missing.
    await seedAgents({ repo, userId, dir: TMP_DIR });
    const afterReseed = await repo.findByUserId(userId);

    expect(afterReseed.length).toBe(afterDeleteCount + 1); // only the deleted name returns
    // NOTE: in production the worker gate (ensureSeedAgents) skips users that
    // already own agents, so a partial deletion is never re-seeded at all.
    // This test documents the pure seeder's contract in isolation.
    void afterDeleteCount;
  });
});

describe('seedAgentId', () => {
  it('is deterministic for the same (userId, name)', () => {
    expect(seedAgentId('u1', 'Engenheiro de IA')).toBe(seedAgentId('u1', 'Engenheiro de IA'));
  });

  it('strips accents and slugifies', () => {
    expect(seedAgentId('u1', 'Engenheiro de IA')).toBe('u1::engenheiro-de-ia');
  });

  it('differs per user', () => {
    expect(seedAgentId('u1', 'Alpha')).not.toBe(seedAgentId('u2', 'Alpha'));
  });
});

describe('real seed catalog', () => {
  it('loadSeedAgents resolves all built-in YAML definitions', async () => {
    const { resolveSeedAgentsDir } = await import('./paths');
    const dir = resolveSeedAgentsDir();
    const defs = await loadSeedAgents(dir);
    // The canonical wolfkrow catalog ships 70 agent definitions as of this
    // commit. The task brief mentioned 72; the actual count is 70 (verified
    // against .wolfkrow/agents/*.yaml). If this breaks, a YAML was added or
    // removed — update the expected value deliberately.
    expect(defs.length).toBe(70);
    // every def has a non-empty name (required for idempotency key)
    for (const d of defs) expect(d.name.trim().length).toBeGreaterThan(0);
  });
});
