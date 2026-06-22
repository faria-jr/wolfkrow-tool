import { describe, expect, it } from 'vitest';

import { LionProvider } from '../ai-providers/lion';
import { OpenRouterProvider } from '../ai-providers/openrouter';

describe('OpenRouterProvider', () => {
  it('is an instance of OpenRouterProvider when created directly', () => {
    const p = new OpenRouterProvider('test-key');
    expect(p).toBeInstanceOf(OpenRouterProvider);
  });
});

describe('LionProvider → openrouter prefixes', () => {
  const provider = new LionProvider({ openrouterApiKey: 'or-key' });

  it.each([
    'openrouter/mistral-7b-instruct',
    'google/gemini-2.0-flash',
    'groq/llama-3.1-8b-instant',
    'mistral/mistral-large',
    'together/llama-3-70b',
  ])('resolves %s to same OpenRouterProvider instance', (model) => {
    const a = provider.resolveForTest(model);
    const b = provider.resolveForTest(model);
    expect(a).toBeInstanceOf(OpenRouterProvider);
    expect(a).toBe(b);
  });

  it('all openrouter-routed models share same cached instance', () => {
    const a = provider.resolveForTest('google/gemini-2.0-flash');
    const b = provider.resolveForTest('groq/llama-3.1-8b-instant');
    expect(a).toBe(b);
  });
});
