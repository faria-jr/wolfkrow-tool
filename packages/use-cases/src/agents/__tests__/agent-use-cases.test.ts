import type { Agent, AgentRepo } from '@wolfkrow/domain';
import { Agent as AgentEntity, NotFoundError, ValidationError } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CreateAgentUseCase,
  DeleteAgentUseCase,
  DuplicateAgentUseCase,
  GetAgentUseCase,
  ListAgentsUseCase,
  SyncAgentsToOrchestratorUseCase,
  UpdateAgentUseCase,
} from '../index';

// ── InMemoryAgentRepo ─────────────────────────────────────────────────────────

class InMemoryAgentRepo implements AgentRepo {
  private readonly store = new Map<string, Agent>();

  async findById(id: string): Promise<Agent | null> {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string): Promise<Agent[]> {
    return [...this.store.values()].filter((a) => a.userId === userId);
  }
  async findActiveByUserId(userId: string): Promise<Agent[]> {
    return [...this.store.values()].filter((a) => a.userId === userId && a.isActive);
  }
  async save(agent: Agent): Promise<Agent> {
    this.store.set(agent.id, agent);
    return agent;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const baseInput = {
  userId: 'u1',
  name: 'my-agent',
  description: undefined,
  model: 'claude-sonnet-4-6',
  effort: 'medium' as const,
  thinking: false,
  thinkingBudget: undefined,
  maxTurns: 10,
  allowedTools: [] as string[],
  mcpServers: [] as string[],
  isActive: true,
  skills: [] as string[],
  runtime: 'cloud' as const,
  provider: undefined,
  squad: undefined,
  systemPrompt: 'You are helpful.',
};

// ── CreateAgentUseCase ────────────────────────────────────────────────────────

describe('CreateAgentUseCase', () => {
  let repo: InMemoryAgentRepo;

  beforeEach(() => { repo = new InMemoryAgentRepo(); });

  it('creates and persists agent', async () => {
    const uc = new CreateAgentUseCase(repo);
    const result = await uc.execute(baseInput);
    expect(result.agent.id).toBeTruthy();
    expect(result.agent.name).toBe('my-agent');
    const found = await repo.findById(result.agent.id);
    expect(found).not.toBeNull();
  });

  it('creates agent with claude-compat provider', async () => {
    const uc = new CreateAgentUseCase(repo);
    const result = await uc.execute({ ...baseInput, runtime: 'claude-compat', provider: 'zai', model: 'glm-4.7' });
    expect(result.agent.runtime).toBe('claude-compat');
    expect(result.agent.provider).toBe('zai');
  });

  it('throws ValidationError for empty name', async () => {
    const uc = new CreateAgentUseCase(repo);
    await expect(uc.execute({ ...baseInput, name: '' })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for maxTurns 0', async () => {
    const uc = new CreateAgentUseCase(repo);
    await expect(uc.execute({ ...baseInput, maxTurns: 0 })).rejects.toThrow(ValidationError);
  });
});

// ── UpdateAgentUseCase ────────────────────────────────────────────────────────

describe('UpdateAgentUseCase', () => {
  let repo: InMemoryAgentRepo;
  let existing: Agent;

  beforeEach(async () => {
    repo = new InMemoryAgentRepo();
    existing = await repo.save(AgentEntity.create(baseInput));
  });

  it('patches name and model', async () => {
    const uc = new UpdateAgentUseCase(repo);
    const result = await uc.execute({ id: existing.id, userId: 'u1', patch: { name: 'updated', model: 'claude-haiku-4-5-20251001' } });
    expect(result.agent.name).toBe('updated');
    expect(result.agent.model).toBe('claude-haiku-4-5-20251001');
    expect(result.agent.id).toBe(existing.id);
  });

  it('throws NotFoundError for unknown id', async () => {
    const uc = new UpdateAgentUseCase(repo);
    await expect(uc.execute({ id: 'unknown', userId: 'u1', patch: { name: 'x' } })).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when name patched to empty', async () => {
    const uc = new UpdateAgentUseCase(repo);
    await expect(uc.execute({ id: existing.id, userId: 'u1', patch: { name: '' } })).rejects.toThrow(ValidationError);
  });
});

// ── DeleteAgentUseCase ────────────────────────────────────────────────────────

describe('DeleteAgentUseCase', () => {
  let repo: InMemoryAgentRepo;
  let existing: Agent;

  beforeEach(async () => {
    repo = new InMemoryAgentRepo();
    existing = await repo.save(AgentEntity.create(baseInput));
  });

  it('removes agent from repo', async () => {
    const uc = new DeleteAgentUseCase(repo);
    await uc.execute({ id: existing.id, userId: 'u1' });
    const found = await repo.findById(existing.id);
    expect(found).toBeNull();
  });

  it('throws NotFoundError for unknown id', async () => {
    const uc = new DeleteAgentUseCase(repo);
    await expect(uc.execute({ id: 'unknown', userId: 'u1' })).rejects.toThrow(NotFoundError);
  });
});

// ── DuplicateAgentUseCase ─────────────────────────────────────────────────────

describe('DuplicateAgentUseCase', () => {
  let repo: InMemoryAgentRepo;
  let existing: Agent;

  beforeEach(async () => {
    repo = new InMemoryAgentRepo();
    existing = await repo.save(AgentEntity.create(baseInput));
  });

  it('creates copy with new name and different id', async () => {
    const uc = new DuplicateAgentUseCase(repo);
    const result = await uc.execute({ id: existing.id, userId: 'u1', newName: 'my-agent-copy' });
    expect(result.agent.name).toBe('my-agent-copy');
    expect(result.agent.id).not.toBe(existing.id);
    expect(result.agent.model).toBe(existing.model);
    expect(result.agent.systemPrompt).toBe(existing.systemPrompt);
  });

  it('persists the duplicate', async () => {
    const uc = new DuplicateAgentUseCase(repo);
    const result = await uc.execute({ id: existing.id, userId: 'u1', newName: 'copy' });
    const found = await repo.findById(result.agent.id);
    expect(found).not.toBeNull();
  });

  it('throws NotFoundError for unknown source id', async () => {
    const uc = new DuplicateAgentUseCase(repo);
    await expect(uc.execute({ id: 'unknown', userId: 'u1', newName: 'copy' })).rejects.toThrow(NotFoundError);
  });
});

// ── ListAgentsUseCase ─────────────────────────────────────────────────────────

describe('ListAgentsUseCase', () => {
  let repo: InMemoryAgentRepo;

  beforeEach(async () => {
    repo = new InMemoryAgentRepo();
    await repo.save(AgentEntity.create({ ...baseInput, name: 'agent-1' }));
    await repo.save(AgentEntity.create({ ...baseInput, name: 'agent-2', isActive: false }));
    await repo.save(AgentEntity.create({ ...baseInput, name: 'agent-3', userId: 'u2' }));
  });

  it('lists all agents for user', async () => {
    const uc = new ListAgentsUseCase(repo);
    const result = await uc.execute({ userId: 'u1' });
    expect(result.agents).toHaveLength(2);
  });

  it('filters active only when requested', async () => {
    const uc = new ListAgentsUseCase(repo);
    const result = await uc.execute({ userId: 'u1', activeOnly: true });
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]?.name).toBe('agent-1');
  });

  it('returns empty for user with no agents', async () => {
    const uc = new ListAgentsUseCase(repo);
    const result = await uc.execute({ userId: 'u-nobody' });
    expect(result.agents).toHaveLength(0);
  });
});

describe('SyncAgentsToOrchestratorUseCase', () => {
  let repo: InMemoryAgentRepo;
  beforeEach(async () => {
    repo = new InMemoryAgentRepo();
    await new CreateAgentUseCase(repo).execute({ ...baseInput, name: 'a1', userId: 'u1', runtime: 'cloud' });
    await new CreateAgentUseCase(repo).execute({ ...baseInput, name: 'a2', userId: 'u1', runtime: 'local' });
  });

  it('updates all agents to target runtime', async () => {
    const uc = new SyncAgentsToOrchestratorUseCase(repo);
    const out = await uc.execute({ userId: 'u1', targetRuntime: 'codex', targetModel: undefined });
    expect(out.synced).toBe(2);
    out.agents.forEach((a) => expect(a.runtime).toBe('codex'));
  });

  it('updates model when targetModel provided', async () => {
    const uc = new SyncAgentsToOrchestratorUseCase(repo);
    const out = await uc.execute({ userId: 'u1', targetRuntime: 'cloud', targetModel: 'gpt-4o' });
    expect(out.agents.every((a) => a.model === 'gpt-4o')).toBe(true);
  });

  it('returns 0 when all already on target runtime', async () => {
    const uc = new SyncAgentsToOrchestratorUseCase(repo);
    await uc.execute({ userId: 'u1', targetRuntime: 'codex', targetModel: undefined });
    const out = await uc.execute({ userId: 'u1', targetRuntime: 'codex', targetModel: undefined });
    expect(out.synced).toBe(0);
  });
});

// ── GetAgentUseCase ──────────────────────────────────────────────────────────

describe('GetAgentUseCase', () => {
  let repo: InMemoryAgentRepo;
  beforeEach(() => { repo = new InMemoryAgentRepo(); });

  it('returns the agent when it exists', async () => {
    const { agent: created } = await new CreateAgentUseCase(repo).execute({ ...baseInput, userId: 'u1', name: 'a1' });
    const out = await new GetAgentUseCase(repo).execute({ id: created.id, userId: 'u1' });
    expect(out.agent.id).toBe(created.id);
    expect(out.agent.name).toBe('a1');
  });

  it('throws NotFoundError when the agent does not exist', async () => {
    await expect(new GetAgentUseCase(repo).execute({ id: 'missing', userId: 'u1' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
