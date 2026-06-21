import type { AIProvider } from '@wolfkrow/infra';
import keytar from 'keytar';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createAgentExecutor, type AgentExecutorOptions } from '../agent-executor';
import { createTestAIProviderFactory } from '../test-utils/ai-provider';

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

function createExecutor(options: AgentExecutorOptions = {}): ReturnType<typeof createAgentExecutor> {
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

    await expect(executor.execute(baseTask)).rejects.toThrow('Missing anthropic-api-key');
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
});
