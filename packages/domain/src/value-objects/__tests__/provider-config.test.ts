import { describe, expect, it } from 'vitest';
import { ProviderConfig, PROVIDER_PROTOCOLS } from '../provider-config';

describe('ProviderConfig', () => {
  it('creates a valid anthropic-compat provider', () => {
    const p = ProviderConfig.create({
      id: 'zai',
      displayName: 'Z.ai (GLM)',
      protocol: 'anthropic-compat',
      baseUrl: 'https://api.z.ai/api/anthropic',
      apiKeyAccount: 'zai-api-key',
      models: ['glm-4.7'],
      supportsTools: true,
    });
    expect(p.id).toBe('zai');
    expect(p.supportsTools).toBe(true);
  });

  it('creates a valid openai-compatible provider', () => {
    const p = ProviderConfig.create({
      id: 'ollama',
      displayName: 'Ollama',
      protocol: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      apiKeyAccount: 'ollama',
      models: ['llama-3'],
      supportsTools: false,
    });
    expect(p.protocol).toBe('openai-compatible');
    expect(p.supportsTools).toBe(false);
  });

  it('rejects empty id', () => {
    expect(() =>
      ProviderConfig.create({
        id: '',
        displayName: 'X',
        protocol: 'openai-compatible',
        baseUrl: 'https://x',
        apiKeyAccount: 'x',
        models: ['m1'],
        supportsTools: false,
      }),
    ).toThrow('id required');
  });

  it('rejects empty models array', () => {
    expect(() =>
      ProviderConfig.create({
        id: 'x',
        displayName: 'X',
        protocol: 'openai-compatible',
        baseUrl: 'https://x',
        apiKeyAccount: 'x',
        models: [],
        supportsTools: false,
      }),
    ).toThrow('at least one model');
  });

  it('PROVIDER_PROTOCOLS contains both valid protocols', () => {
    expect(PROVIDER_PROTOCOLS).toContain('anthropic-compat');
    expect(PROVIDER_PROTOCOLS).toContain('openai-compatible');
  });

  it('exposes toJSON returning all props', () => {
    const p = ProviderConfig.create({
      id: 'a',
      displayName: 'A',
      protocol: 'anthropic-compat',
      baseUrl: 'https://a',
      apiKeyAccount: 'a',
      models: ['m1'],
      supportsTools: true,
    });
    const json = p.toJSON();
    expect(json.id).toBe('a');
    expect(json.models).toEqual(['m1']);
  });

  it('exposes optional pricingUrl', () => {
    const p = ProviderConfig.create({
      id: 'b',
      displayName: 'B',
      protocol: 'anthropic-compat',
      baseUrl: 'https://b',
      apiKeyAccount: 'b',
      models: ['m1'],
      supportsTools: false,
      pricingUrl: 'https://b/pricing',
    });
    expect(p.pricingUrl).toBe('https://b/pricing');
  });
});
