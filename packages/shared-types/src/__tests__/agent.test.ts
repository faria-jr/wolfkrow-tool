import { describe, expect, it } from 'vitest';

import {
  AgentSchema,
  CreateAgentInputSchema,
  AgentYamlSchema,
  UpdateAgentInputSchema,
} from '../schemas/agent';
import { EffortSchema, RuntimeSchema, SquadSchema } from '../schemas/common';

describe('Common enums', () => {
  it('accepts valid effort values', () => {
    const values = EffortSchema.options;
    values.forEach((value: 'low' | 'medium' | 'high' | 'max') => {
      expect(EffortSchema.parse(value)).toBe(value);
    });
  });

  it('rejects invalid effort values', () => {
    expect(() => EffortSchema.parse('extreme')).toThrow();
  });

  it('accepts valid runtime values', () => {
    expect(RuntimeSchema.parse('cloud')).toBe('cloud');
    expect(RuntimeSchema.parse('codex')).toBe('codex');
  });

  it('accepts valid squad values', () => {
    expect(SquadSchema.parse('harness')).toBe('harness');
    expect(SquadSchema.parse('custom')).toBe('custom');
  });
});

describe('AgentSchema', () => {
  const validAgent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'code-reviewer',
    description: 'Reviews code',
    model: 'claude-sonnet-4-5',
    effort: 'high' as const,
    thinking: true,
    thinkingBudget: 10000,
    maxTurns: 80,
    allowedTools: ['Read', 'Grep'],
    mcpServers: [],
    isActive: true,
    skills: [],
    runtime: 'cloud' as const,
    squad: 'harness' as const,
    systemPrompt: 'You are a code reviewer',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a valid agent', () => {
    expect(AgentSchema.parse(validAgent)).toEqual(validAgent);
  });

  it('rejects missing required fields', () => {
    const invalid = { ...validAgent };
    delete (invalid as Partial<typeof validAgent>).name;
    expect(() => AgentSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid effort value', () => {
    const invalid = { ...validAgent, effort: 'extreme' };
    expect(() => AgentSchema.parse(invalid)).toThrow();
  });

  it('rejects negative maxTurns', () => {
    const invalid = { ...validAgent, maxTurns: -1 };
    expect(() => AgentSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid UUID for id', () => {
    const invalid = { ...validAgent, id: 'not-a-uuid' };
    expect(() => AgentSchema.parse(invalid)).toThrow();
  });

  it('rejects empty name', () => {
    const invalid = { ...validAgent, name: '' };
    expect(() => AgentSchema.parse(invalid)).toThrow();
  });
});

describe('CreateAgentInputSchema', () => {
  it('omits server-managed fields', () => {
    const input = {
      name: 'test',
      model: 'claude-sonnet-4-5',
      effort: 'medium' as const,
      runtime: 'cloud' as const,
    };
    const parsed = CreateAgentInputSchema.parse(input);
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('createdAt');
  });

  it('applies defaults', () => {
    const parsed = CreateAgentInputSchema.parse({
      name: 'test',
      model: 'claude-sonnet-4-5',
      effort: 'medium',
      runtime: 'cloud',
    });
    expect(parsed.thinking).toBe(false);
    expect(parsed.maxTurns).toBe(80);
    expect(parsed.allowedTools).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });
});

describe('UpdateAgentInputSchema', () => {
  it('accepts partial updates', () => {
    expect(UpdateAgentInputSchema.parse({ name: 'renamed' })).toEqual({ name: 'renamed' });
    expect(UpdateAgentInputSchema.parse({})).toEqual({});
  });

  it('rejects invalid field types in partial', () => {
    expect(() => UpdateAgentInputSchema.parse({ maxTurns: -1 })).toThrow();
  });
});

describe('AgentYamlSchema', () => {
  it('validates YAML frontmatter format', () => {
    const yaml = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'test',
      model: 'claude-sonnet-4-5',
      effort: 'high' as const,
      runtime: 'cloud' as const,
      tags: ['review', 'security'],
      examples: [{ input: 'review this', output: 'looks good' }],
      metadata: {
        author: 'wolfkrow-labs',
        version: '1.0.0',
      },
      allowedTools: [],
      mcpServers: [],
      isActive: true,
      skills: [],
      thinking: false,
      maxTurns: 80,
      metadata2: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => AgentYamlSchema.parse(yaml)).not.toThrow();
  });
});
