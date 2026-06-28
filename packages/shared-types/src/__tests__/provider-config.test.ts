import { describe, expect, it } from 'vitest';

import { ProviderConfigResponseSchema } from '../schemas/provider-config';

const validProvider = {
  id: 'zai',
  displayName: 'Z.ai',
  protocol: 'openai-compatible' as const,
  baseUrl: 'https://api.z.ai/v1',
  apiKeyAccount: 'zai-api-key',
  models: ['glm-4.7'],
  supportsTools: true,
  hasApiKey: true,
};

describe('ProviderConfigResponseSchema', () => {
  it('accepts a valid provider response with hasApiKey', () => {
    const parsed = ProviderConfigResponseSchema.parse(validProvider);
    expect(parsed.hasApiKey).toBe(true);
  });

  it('accepts hasApiKey false', () => {
    const parsed = ProviderConfigResponseSchema.parse({ ...validProvider, hasApiKey: false });
    expect(parsed.hasApiKey).toBe(false);
  });

  it('accepts optional pricingUrl', () => {
    const parsed = ProviderConfigResponseSchema.parse({
      ...validProvider,
      pricingUrl: 'https://z.ai/pricing',
    });
    expect(parsed.pricingUrl).toBe('https://z.ai/pricing');
  });

  it('rejects missing hasApiKey', () => {
    const { hasApiKey: _omit, ...rest } = validProvider;
    expect(() => ProviderConfigResponseSchema.parse(rest)).toThrow();
  });

  it('rejects invalid protocol', () => {
    expect(() =>
      ProviderConfigResponseSchema.parse({ ...validProvider, protocol: 'custom' })
    ).toThrow();
  });

  it('rejects empty models array', () => {
    expect(() => ProviderConfigResponseSchema.parse({ ...validProvider, models: [] })).toThrow();
  });

  it('rejects malformed baseUrl', () => {
    expect(() =>
      ProviderConfigResponseSchema.parse({ ...validProvider, baseUrl: 'not-a-url' })
    ).toThrow();
  });
});
