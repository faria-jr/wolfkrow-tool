import { describe, expect, it } from 'vitest';

import { Agent, ValidationError } from '../index';

const base = {
  userId: 'u1',
  name: 'code-reviewer',
  description: undefined,
  model: 'claude-sonnet-4-6',
  effort: 'medium' as const,
  thinking: false,
  thinkingBudget: undefined,
  maxTurns: 10,
  allowedTools: ['read_file', 'grep'],
  mcpServers: [],
  isActive: true,
  skills: [],
  runtime: 'cloud' as const,
  provider: undefined,
  squad: undefined,
  systemPrompt: 'You are a code reviewer.',
};

describe('Agent.create', () => {
  it('creates agent with all required fields', () => {
    const agent = Agent.create(base);
    expect(agent.id).toBeTruthy();
    expect(agent.name).toBe('code-reviewer');
    expect(agent.model).toBe('claude-sonnet-4-6');
    expect(agent.effort).toBe('medium');
    expect(agent.maxTurns).toBe(10);
    expect(agent.isActive).toBe(true);
    expect(agent.createdAt).toBeInstanceOf(Date);
    expect(agent.updatedAt).toBeInstanceOf(Date);
    expect(agent.provider).toBeUndefined();
  });

  it('supports claude-compat runtime with provider', () => {
    const agent = Agent.create({ ...base, runtime: 'claude-compat', provider: 'zai', model: 'glm-4.7' });
    expect(agent.runtime).toBe('claude-compat');
    expect(agent.provider).toBe('zai');
    expect(agent.model).toBe('glm-4.7');
  });

  it('generates unique ids', () => {
    const a = Agent.create(base);
    const b = Agent.create(base);
    expect(a.id).not.toBe(b.id);
  });

  it('throws ValidationError for empty name', () => {
    expect(() => Agent.create({ ...base, name: '' })).toThrow(ValidationError);
    expect(() => Agent.create({ ...base, name: '   ' })).toThrow(ValidationError);
  });

  it('throws ValidationError for maxTurns < 1', () => {
    expect(() => Agent.create({ ...base, maxTurns: 0 })).toThrow(ValidationError);
    expect(() => Agent.create({ ...base, maxTurns: -5 })).toThrow(ValidationError);
  });

  it('defaults isActive to true when not specified', () => {
    const agent = Agent.create({ ...base, isActive: false });
    expect(agent.isActive).toBe(false);
  });

  it('preserves allowedTools array', () => {
    const agent = Agent.create(base);
    expect(agent.allowedTools).toEqual(['read_file', 'grep']);
  });
});

describe('Agent.fromProps / toProps', () => {
  it('roundtrip preserves all fields', () => {
    const now = new Date('2024-01-01');
    const props = {
      id: 'a1',
      ...base,
      createdAt: now,
      updatedAt: now,
    };
    const agent = Agent.fromProps(props);
    expect(agent.toProps()).toEqual(props);
  });

  it('roundtrip preserves provider when set', () => {
    const now = new Date('2024-01-01');
    const props = {
      id: 'a1',
      ...base,
      runtime: 'claude-compat' as const,
      provider: 'moonshot',
      createdAt: now,
      updatedAt: now,
    };
    const agent = Agent.fromProps(props);
    expect(agent.toProps().provider).toBe('moonshot');
    expect(agent.toProps().runtime).toBe('claude-compat');
  });
});

describe('Agent.duplicate', () => {
  it('creates new agent with different id and name', () => {
    const original = Agent.create({ ...base, provider: 'qwen' });
    const copy = original.duplicate('code-reviewer-v2');
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('code-reviewer-v2');
    expect(copy.model).toBe(original.model);
    expect(copy.systemPrompt).toBe(original.systemPrompt);
    expect(copy.allowedTools).toEqual(original.allowedTools);
    expect(copy.provider).toBe('qwen');
  });

  it('throws ValidationError for empty duplicate name', () => {
    const original = Agent.create(base);
    expect(() => original.duplicate('')).toThrow(ValidationError);
  });
});

describe('Agent.buildPrompt', () => {
  it('returns systemPrompt when no skills', () => {
    const agent = Agent.create({ ...base, systemPrompt: 'Be helpful.' });
    const prompt = agent.buildPrompt({});
    expect(prompt).toContain('Be helpful.');
  });

  it('includes skills in prompt when provided', () => {
    const agent = Agent.create({ ...base, skills: ['typescript', 'react'], systemPrompt: 'Review code.' });
    const prompt = agent.buildPrompt({});
    expect(prompt).toContain('typescript');
    expect(prompt).toContain('react');
  });

  it('returns empty string when no systemPrompt and no skills', () => {
    const agent = Agent.create({ ...base, systemPrompt: undefined, skills: [] });
    const prompt = agent.buildPrompt({});
    expect(prompt).toBe('');
  });
});

describe('Agent.activate / deactivate', () => {
  it('deactivate sets isActive=false', () => {
    const agent = Agent.create(base);
    const deactivated = agent.deactivate();
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.id).toBe(agent.id);
  });

  it('activate sets isActive=true', () => {
    const agent = Agent.create({ ...base, isActive: false });
    const activated = agent.activate();
    expect(activated.isActive).toBe(true);
  });
});

describe('Agent.update', () => {
  it('patches name and model', () => {
    const agent = Agent.create(base);
    const updated = agent.update({ name: 'new-name', model: 'claude-haiku-4-5-20251001' });
    expect(updated.name).toBe('new-name');
    expect(updated.model).toBe('claude-haiku-4-5-20251001');
    expect(updated.id).toBe(agent.id);
    expect(updated.userId).toBe(agent.userId);
  });

  it('patches provider and runtime', () => {
    const agent = Agent.create(base);
    const updated = agent.update({ runtime: 'claude-compat', provider: 'minimax' });
    expect(updated.runtime).toBe('claude-compat');
    expect(updated.provider).toBe('minimax');
  });

  it('updatedAt changes after update', () => {
    const agent = Agent.create(base);
    const before = agent.updatedAt;
    const updated = agent.update({ name: 'renamed' });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('throws ValidationError when patching name to empty', () => {
    const agent = Agent.create(base);
    expect(() => agent.update({ name: '' })).toThrow(ValidationError);
  });
});
