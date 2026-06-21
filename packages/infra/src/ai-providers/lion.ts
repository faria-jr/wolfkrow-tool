/**
 * LionProvider — roteador universal multi-provider.
 * Despacha para o adapter correto baseado no prefixo do modelo.
 *
 * Adapters implementados:
 *   anthropic  → AnthropicProvider   (claude-*)
 *   openai     → CodexProvider       (gpt-*, o1-*, o3-*)
 *   ollama     → CodexProvider       (llama-*, qwen-*, phi-*, mistral-*, gemma-*)
 *
 * Stubs (P1 — A.2 completo):
 *   google     → gemini-*  (requer @google/generative-ai)
 *   zai        → zai-*     (requer @zai/sdk)
 *   groq       → groq-*    (requer groq-sdk)
 *   together   → together-* (requer together SDK)
 */

import { AnthropicProvider } from './anthropic';
import { CodexProvider } from './codex';
import type { AIProvider, ChatMessage, CompletionOptions, CompletionResult, StreamChunk } from './types';

const OLLAMA_DEFAULT_URL = 'http://localhost:11434/v1';

const OPENAI_PREFIXES = ['gpt-', 'o1-', 'o3-', 'o4-', 'ft:gpt-'];
const OLLAMA_PREFIXES = ['llama-', 'qwen', 'phi-', 'mistral', 'gemma', 'deepseek', 'codellama', 'vicuna'];

export interface LionProviderConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

export class LionProvider implements AIProvider {
  constructor(private readonly config: LionProviderConfig) {}

  private resolve(model: string): AIProvider {
    const m = model.toLowerCase();

    if (m.startsWith('claude-')) {
      if (!this.config.anthropicApiKey) throw new Error('LionProvider: anthropicApiKey required for claude-* models');
      return new AnthropicProvider(this.config.anthropicApiKey);
    }

    if (OPENAI_PREFIXES.some((p) => m.startsWith(p))) {
      if (!this.config.openaiApiKey) throw new Error('LionProvider: openaiApiKey required for gpt-*/o1-* models');
      return new CodexProvider(this.config.openaiApiKey);
    }

    if (OLLAMA_PREFIXES.some((p) => m.startsWith(p))) {
      const baseURL = this.config.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL;
      return new CodexProvider('ollama', baseURL);
    }

    if (m.startsWith('gemini-')) throw new Error(`LionProvider: Google GenAI adapter not yet implemented (model: ${model})`);
    if (m.startsWith('zai-')) throw new Error(`LionProvider: Z.ai adapter not yet implemented (model: ${model})`);
    if (m.startsWith('groq-')) throw new Error(`LionProvider: Groq adapter not yet implemented (model: ${model})`);

    throw new Error(`LionProvider: unknown model prefix — cannot resolve provider for "${model}"`);
  }

  query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    return this.resolve(options.model).query(options);
  }

  complete(options: CompletionOptions): Promise<CompletionResult> {
    return this.resolve(options.model).complete(options);
  }

  countTokens(messages: ChatMessage[], model: string): Promise<number> {
    return this.resolve(model).countTokens(messages, model);
  }
}
