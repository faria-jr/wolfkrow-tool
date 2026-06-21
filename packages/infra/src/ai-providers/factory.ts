/**
 * AI provider factory — Strategy selection (§1.5 O). Novos SDKs = novo case,
 * zero edição nos callers. A.2 adiciona claude-agent/claude-compat/codex/lion.
 */

import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import type { AIProvider, AIProviderFactory } from './types';

export class ProviderAIProviderFactory implements AIProviderFactory {
  create(provider: string, apiKey: string): AIProvider {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'mock':
        return new MockProvider();
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}

export * from './types';
export { AnthropicProvider } from './anthropic';
export { MockProvider } from './mock';
export { accumulate, estimateTokens } from './helpers';
