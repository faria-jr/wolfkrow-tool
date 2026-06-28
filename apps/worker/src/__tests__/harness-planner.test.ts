/**
 * RM7.3 — makePlanner injects repoSummary into LLM prompt when provided.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const completeSpy = vi.fn().mockResolvedValue({
  content: '[{"name":"Sprint 1","description":"d","features":[]}]',
  usage: { inputTokens: 10, outputTokens: 5 },
});
const createFromConfigSpy = vi.fn().mockReturnValue({ complete: completeSpy });

vi.mock('../lib/keychain', () => ({
  getAnthropicApiKey: vi.fn().mockResolvedValue('sk-ant-test'),
  getProviderApiKey: vi.fn().mockResolvedValue('sk-test'),
  getSecret: vi.fn().mockResolvedValue(null),
}));

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(false),
  },
}));

import { getHarnessAgents, getAdapters, resetAdapters } from '../container';

describe('makePlanner — repoSummary injection (RM7.3)', () => {
  beforeEach(() => {
    resetAdapters();
    completeSpy.mockClear();
    createFromConfigSpy.mockClear();

    const adapters = getAdapters();
    (
      adapters.aiFactory as unknown as { createFromConfig: typeof createFromConfigSpy }
    ).createFromConfig = createFromConfigSpy;
    (adapters.secrets as unknown as { get: () => Promise<string> }).get = async () => 'sk-mock';
  });

  afterEach(() => {
    resetAdapters();
  });

  it('includes repoSummary in user message when provided', async () => {
    const agents = await getHarnessAgents({
      plannerModel: 'claude-haiku-4-5-20251001',
      coderModel: 'x',
      maxRoundsPerFeature: 3,
    });
    await agents.planner.plan('# My Spec', {
      plannerModel: 'claude-haiku-4-5-20251001',
      repoSummary: '5 files | Languages: typescript',
    });

    expect(completeSpy).toHaveBeenCalledOnce();
    const call = completeSpy.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    expect(call.messages[0]!.content).toContain('5 files | Languages: typescript');
    expect(call.messages[0]!.content).toContain('# My Spec');
  });

  it('does NOT include repo context section when repoSummary is absent', async () => {
    const agents = await getHarnessAgents({
      plannerModel: 'claude-haiku-4-5-20251001',
      coderModel: 'x',
      maxRoundsPerFeature: 3,
    });
    await agents.planner.plan('# My Spec', { plannerModel: 'claude-haiku-4-5-20251001' });

    const call = completeSpy.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    expect(call.messages[0]!.content).not.toContain('Repository context');
  });
});
