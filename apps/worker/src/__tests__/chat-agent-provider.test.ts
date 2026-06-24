/**
 * RM3.2 — resolveAgentStreamPort uses ClaudeCompatProvider for non-Anthropic agents.
 * Verifies that getAnthropicApiKey is NOT called when agent.provider is 'zai'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { anthropicKeySpy, keychainProviderSpy } = vi.hoisted(() => ({
  anthropicKeySpy: vi.fn().mockResolvedValue('sk-ant-test'),
  keychainProviderSpy: vi.fn().mockResolvedValue('sk-zai-test'),
}));

vi.mock('../lib/keychain', () => ({
  getAnthropicApiKey: anthropicKeySpy,
  getProviderApiKey: keychainProviderSpy,
  getSecret: vi.fn().mockResolvedValue(null),
}));

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn().mockResolvedValue('sk-keytar-zai'),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(false),
  },
}));

import { resetAdapters, resolveAgentStreamPort } from '../container';

describe('resolveAgentStreamPort (RM3.2)', () => {
  beforeEach(() => {
    resetAdapters();
    anthropicKeySpy.mockClear();
    keychainProviderSpy.mockClear();
  });

  afterEach(() => {
    resetAdapters();
  });

  it('uses Anthropic key when provider is undefined (default)', async () => {
    const port = await resolveAgentStreamPort({ agentProvider: undefined, allowedTools: ['bash'], workDir: '/tmp', requestPermission: () => Promise.resolve(true) });
    expect(port).toBeDefined();
    expect(anthropicKeySpy).toHaveBeenCalled();
  });

  it('uses Anthropic key when provider is explicitly anthropic', async () => {
    const port = await resolveAgentStreamPort({ agentProvider: 'anthropic', allowedTools: ['bash'], workDir: '/tmp', requestPermission: () => Promise.resolve(true) });
    expect(port).toBeDefined();
    expect(anthropicKeySpy).toHaveBeenCalled();
  });

  it('does NOT call getAnthropicApiKey when provider is zai', async () => {
    const port = await resolveAgentStreamPort({ agentProvider: 'zai', allowedTools: ['bash'], workDir: '/tmp', requestPermission: () => Promise.resolve(true) });
    expect(port).toBeDefined();
    expect(anthropicKeySpy).not.toHaveBeenCalled();
  });

  it('resolves zai key from secrets or keychain fallback (not Anthropic)', async () => {
    await resolveAgentStreamPort({ agentProvider: 'zai', allowedTools: ['bash'], workDir: '/tmp', requestPermission: () => Promise.resolve(true) });
    expect(anthropicKeySpy).not.toHaveBeenCalled();
  });
});
