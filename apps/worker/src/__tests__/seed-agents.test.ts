import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadSeedAgents } from '../seed-agents/loader';
import { SeedAgentSchema } from '../seed-agents/schema';

const AGENTS_DIR = join(import.meta.dirname, '../seed-agents/yaml');

describe('SeedAgentSchema', () => {
  it('validates minimal agent', () => {
    const result = SeedAgentSchema.parse({ name: 'Test Agent' });
    expect(result.name).toBe('Test Agent');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.effort).toBe('medium');
    expect(result.maxTurns).toBe(80);
    expect(result.isActive).toBe(true);
    expect(result.runtime).toBe('cloud');
    expect(result.skills).toEqual([]);
  });

  it('validates full agent with optional fields', () => {
    const result = SeedAgentSchema.parse({
      name: 'Full Agent',
      model: 'claude-opus-4-8',
      effort: 'high',
      thinking: true,
      thinkingBudget: 5000,
      maxTurns: 50,
      allowedTools: ['bash', 'read_file'],
      mcpServers: ['mcp-server-1'],
      isActive: false,
      skills: ['pdf'],
      runtime: 'local',
      squad: 'harness',
      systemPrompt: 'You are an expert.',
      tags: ['expert'],
    });
    expect(result.thinking).toBe(true);
    expect(result.thinkingBudget).toBe(5000);
    expect(result.squad).toBe('harness');
  });

  it('rejects missing name', () => {
    expect(() => SeedAgentSchema.parse({ model: 'claude-sonnet-4-6' })).toThrow();
  });

  it('rejects invalid effort', () => {
    expect(() => SeedAgentSchema.parse({ name: 'x', effort: 'ultra' })).toThrow();
  });

  it('rejects invalid runtime', () => {
    expect(() => SeedAgentSchema.parse({ name: 'x', runtime: 'unknown' })).toThrow();
  });
});

describe('loadSeedAgents', () => {
  it('loads all YAML agents from .wolfkrow/agents', async () => {
    const agents = await loadSeedAgents(AGENTS_DIR);
    expect(agents.length).toBeGreaterThanOrEqual(4);
  });

  it('each agent passes schema validation', async () => {
    const agents = await loadSeedAgents(AGENTS_DIR);
    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.model).toBeTruthy();
    }
  });

  it('loads General Assistant with expected fields', async () => {
    const agents = await loadSeedAgents(AGENTS_DIR);
    const ga = agents.find((a) => a.name === 'General Assistant');
    expect(ga).toBeDefined();
    expect(ga?.runtime).toBe('cloud');
    expect(ga?.allowedTools).toContain('bash');
  });

  it('loads Data Analyst with thinking enabled', async () => {
    const agents = await loadSeedAgents(AGENTS_DIR);
    const da = agents.find((a) => a.name === 'Data Analyst');
    expect(da).toBeDefined();
    expect(da?.thinking).toBe(true);
    expect(da?.thinkingBudget).toBeGreaterThan(0);
  });

  it('loads Code Reviewer with correct effort', async () => {
    const agents = await loadSeedAgents(AGENTS_DIR);
    const cr = agents.find((a) => a.name === 'Code Reviewer');
    expect(cr).toBeDefined();
    expect(cr?.effort).toBe('high');
  });
});
