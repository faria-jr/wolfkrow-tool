import { describe, expect, it } from 'vitest';

import { LionProvider } from '../ai-providers/lion';

describe('LionProvider instance caching', () => {
  it('returns same adapter instance for same model prefix', () => {
    const provider = new LionProvider({ anthropicApiKey: 'test-key' });
    const a = provider.resolveForTest('claude-3-5-sonnet-20241022');
    const b = provider.resolveForTest('claude-3-5-sonnet-20241022');
    expect(a).toBe(b);
  });

  it('returns different adapters for different model prefixes', () => {
    const provider = new LionProvider({
      anthropicApiKey: 'test-key',
      openaiApiKey: 'oai-key',
    });
    const claude = provider.resolveForTest('claude-3-5-sonnet-20241022');
    const gpt = provider.resolveForTest('gpt-4o');
    expect(claude).not.toBe(gpt);
  });

  it('throws for unknown model when no customBaseUrl', () => {
    const provider = new LionProvider({});
    expect(() => provider.resolveForTest('unknown-model-xyz')).toThrow('unknown model prefix');
  });
});
