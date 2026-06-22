/**
 * AI provider factory — Strategy selection (§1.5 O).
 * Novos SDKs = novo case, zero edição nos callers.
 */

import { AnthropicProvider } from './anthropic';
import { ClaudeAgentProvider } from './claude-agent';
import { ClaudeCompatProvider } from './claude-compat';
import { CodexProvider } from './codex';
import { LionProvider } from './lion';
import { MockProvider } from './mock';
import { OpenRouterProvider } from './openrouter';
import type { AIProvider, AIProviderFactory } from './types';

export class ProviderAIProviderFactory implements AIProviderFactory {
  create(provider: string, apiKey: string): AIProvider {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'claude-agent':
        return new ClaudeAgentProvider(apiKey);
      case 'claude-compat':
        return new ClaudeCompatProvider(apiKey);
      case 'codex':
      case 'openai':
        return new CodexProvider(apiKey);
      case 'lion':
        return new LionProvider({ anthropicApiKey: apiKey });
      case 'openrouter':
        return new OpenRouterProvider(apiKey);
      case 'ollama':
        return new CodexProvider('ollama', 'http://localhost:11434/v1');
      case 'mock':
        return new MockProvider();
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}

export * from './types';
export { AnthropicProvider } from './anthropic';
export { ClaudeAgentProvider } from './claude-agent';
export { ClaudeCompatProvider } from './claude-compat';
export { CodexProvider } from './codex';
export { LionProvider } from './lion';
export { MockProvider } from './mock';
export { OpenRouterProvider } from './openrouter';
export { accumulate, estimateTokens } from './helpers';
