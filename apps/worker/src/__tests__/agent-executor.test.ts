import type { AIProvider } from '@wolfkrow/infra';
import keytar from 'keytar';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createAgentExecutor, type AgentExecutorOptions } from '../agent-executor';
import { createTestAIProviderFactory } from '../test-utils/ai-provider';

// FIX-004: executor resolves repos via the container. Mock it so no real DB is
// touched; tests provide agents/skills/rules through the mutable fake repos.
const fakeRepos = {
  agent: { findById: async (_id: string) => null },
  skill: { findByUserId: async (_u: string) => [] as unknown[] },
  globalRule: { findAll: async (_u: string) => [] as unknown[] },
};
vi.mock('../container', () => ({ getRepos: () => fakeRepos }));

const mockProvider: AIProvider = {
  async complete() {
    return {
      content: 'Hello from mock provider',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  },
  async *query() {
    yield { delta: 'Hello from mock provider' };
    yield { delta: '', done: true, inputTokens: 10, outputTokens: 5 };
  },
  async countTokens() {
    return 15;
  },
};

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
  },
}));

function createExecutor(
  options: AgentExecutorOptions = {}
): ReturnType<typeof createAgentExecutor> {
  return createAgentExecutor({
    providerFactory: createTestAIProviderFactory(mockProvider),
    keytarService: 'test-wolfkrow',
    ...options,
  });
}

const baseTask = {
  id: 'task-1',
  name: 'Test task',
  prompt: 'Say hello',
  agentId: undefined,
};

describe('AgentExecutor', () => {
  beforeEach(() => {
    vi.mocked(keytar.getPassword).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when API key is missing', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue(null);

    const executor = createExecutor();

    await expect(executor.execute(baseTask)).rejects.toThrow('Missing API key in keychain');
  });

  it('returns AI provider response when key exists', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue('fake-api-key');

    const executor = createExecutor();
    const result = await executor.execute(baseTask);

    expect(result.status).toBe('validated');
    expect(result.output).toMatchObject({
      content: 'Hello from mock provider',
      inputTokens: 10,
      outputTokens: 5,
    });
  });

  it('uses default system prompt when no agent is linked', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue('fake-api-key');
    const completeSpy = vi.spyOn(mockProvider, 'complete');

    const executor = createExecutor();
    await executor.execute(baseTask);

    expect(completeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful assistant.',
      })
    );
  });

  it('FIX-026: uses custom temperature when provided', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue('fake-api-key');
    const completeSpy = vi.spyOn(mockProvider, 'complete');

    const executor = createExecutor({ temperature: 0.2, maxTokens: 1024 });
    await executor.execute(baseTask);

    expect(completeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2, maxTokens: 1024 })
    );
  });

  it('FIX-004: injects enabled global rules into the system prompt', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue('fake-api-key');
    const completeSpy = vi.spyOn(mockProvider, 'complete');
    // An enabled rule with a prompt section the builder will concatenate.
    fakeRepos.globalRule.findAll = async () => [
      {
        enabled: true,
        kind: 'behavior',
        sortOrder: 0,
        toPromptSection: () => 'Always cite sources.',
      },
    ];

    const executor = createExecutor();
    await executor.execute(baseTask);

    const system = completeSpy.mock.calls[0]?.[0]?.system ?? '';
    expect(system).toContain('Always cite sources.');
  });
});
