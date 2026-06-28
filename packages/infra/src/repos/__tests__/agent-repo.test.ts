import { Agent } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { DrizzleAgentRepo } from '../agent-repo';

import { mockDb } from './mock-db';

const userId = 'user-1';
const agentId = 'agent-1';
const now = new Date('2026-01-01T00:00:00Z');

function createAgentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: agentId,
    userId,
    name: 'Test Agent',
    description: null,
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    thinking: 0,
    thinkingBudget: null,
    maxTurns: 80,
    allowedTools: '[]',
    mcpServers: '[]',
    isActive: 1,
    skills: '[]',
    runtime: 'cloud',
    provider: null,
    squad: null,
    systemPrompt: 'You are helpful.',
    metadata: '{}',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createAgent(runtime: 'cloud' | 'claude-compat' = 'cloud', provider?: string) {
  return Agent.create({
    userId,
    name: 'Test Agent',
    description: undefined,
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    thinking: false,
    thinkingBudget: undefined,
    maxTurns: 80,
    allowedTools: [],
    mcpServers: [],
    isActive: true,
    skills: [],
    runtime,
    provider,
    squad: undefined,
    systemPrompt: 'You are helpful.',
  });
}

describe('DrizzleAgentRepo', () => {
  it('findById returns null when row absent', async () => {
    const { db } = mockDb([]);
    const repo = new DrizzleAgentRepo(db as never);
    expect(await repo.findById(agentId)).toBeNull();
  });

  it('findById returns Agent when row present', async () => {
    const { db } = mockDb([createAgentRow()]);
    const repo = new DrizzleAgentRepo(db as never);
    const result = await repo.findById(agentId);
    expect(result).toBeInstanceOf(Agent);
    expect(result?.id).toBe(agentId);
    expect(result?.runtime).toBe('cloud');
  });

  it('findById maps provider and runtime claude-compat', async () => {
    const { db } = mockDb([
      createAgentRow({ runtime: 'claude-compat', provider: 'zai', model: 'glm-4.7' }),
    ]);
    const repo = new DrizzleAgentRepo(db as never);
    const result = await repo.findById(agentId);
    expect(result?.runtime).toBe('claude-compat');
    expect(result?.provider).toBe('zai');
    expect(result?.model).toBe('glm-4.7');
  });

  it('findByUserId returns agents', async () => {
    const { db } = mockDb([createAgentRow()]);
    const repo = new DrizzleAgentRepo(db as never);
    const results = await repo.findByUserId(userId);
    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Agent);
  });

  it('findActiveByUserId filters active agents', async () => {
    const { db } = mockDb([
      createAgentRow({ isActive: 1 }),
      createAgentRow({ id: 'a2', isActive: 0 }),
    ]);
    const repo = new DrizzleAgentRepo(db as never);
    const results = await repo.findActiveByUserId(userId);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(agentId);
  });

  it('save upserts agent with provider', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleAgentRepo(db as never);
    const agent = createAgent('claude-compat', 'moonshot');
    const saved = await repo.save(agent);
    expect(chain.run).toHaveBeenCalled();
    expect(saved).toBeInstanceOf(Agent);
    expect(saved.provider).toBe('moonshot');
  });

  it('delete calls db.delete', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleAgentRepo(db as never);
    await repo.delete(agentId);
    expect(chain.run).toHaveBeenCalled();
  });
});
