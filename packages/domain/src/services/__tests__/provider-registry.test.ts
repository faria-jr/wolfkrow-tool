import { describe, expect, it } from 'vitest';

import { ProviderConfig } from '../../value-objects/provider-config';
import { BUILT_IN_PROVIDERS, mergeProviders, getProviderById } from '../provider-registry';

describe('ProviderRegistry', () => {
  it('ships built-in providers including anthropic and claude-compat presets', () => {
    const ids = BUILT_IN_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['anthropic', 'zai', 'minimax', 'moonshot', 'qwen', 'openrouter', 'openai', 'ollama']),
    );
  });

  it('all built-in providers have at least one model', () => {
    for (const p of BUILT_IN_PROVIDERS) {
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it('custom provider overrides built-in by id', () => {
    const custom = ProviderConfig.create({
      id: 'zai',
      displayName: 'Z.ai Custom',
      protocol: 'anthropic-compat',
      baseUrl: 'https://custom',
      apiKeyAccount: 'zai-api-key',
      models: ['glm-5.1'],
      supportsTools: true,
    });
    const merged = mergeProviders(BUILT_IN_PROVIDERS, [custom]);
    expect(getProviderById(merged, 'zai')?.displayName).toBe('Z.ai Custom');
  });

  it('new custom provider is added to the list', () => {
    const custom = ProviderConfig.create({
      id: 'my-llm',
      displayName: 'My LLM',
      protocol: 'openai-compatible',
      baseUrl: 'https://my-llm/v1',
      apiKeyAccount: 'my-llm',
      models: ['model-a'],
      supportsTools: false,
    });
    const merged = mergeProviders(BUILT_IN_PROVIDERS, [custom]);
    expect(getProviderById(merged, 'my-llm')?.displayName).toBe('My LLM');
    expect(merged.length).toBe(BUILT_IN_PROVIDERS.length + 1);
  });

  it('getProviderById returns undefined for unknown id', () => {
    expect(getProviderById(BUILT_IN_PROVIDERS, 'unknown-xyz')).toBeUndefined();
  });
});
