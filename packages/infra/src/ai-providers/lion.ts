import { AnthropicProvider } from './anthropic';
import { CodexProvider } from './codex';
import { OpenRouterProvider } from './openrouter';
import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
} from './types';

const OLLAMA_DEFAULT_URL = 'http://localhost:11434/v1';

const OPENAI_PREFIXES = ['gpt-', 'o1-', 'o3-', 'o4-', 'ft:gpt-'];
const OLLAMA_PREFIXES = [
  'llama-',
  'qwen',
  'phi-',
  'mistral',
  'gemma',
  'deepseek',
  'codellama',
  'vicuna',
];
const OPENROUTER_PREFIXES = ['openrouter/', 'google/', 'groq/', 'mistral/', 'together/'];

export interface LionProviderConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  openrouterApiKey?: string;
}

function adapterKey(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith('claude-')) return 'anthropic';
  if (OPENAI_PREFIXES.some((p) => m.startsWith(p))) return 'openai';
  if (OPENROUTER_PREFIXES.some((p) => m.startsWith(p))) return 'openrouter';
  if (OLLAMA_PREFIXES.some((p) => m.startsWith(p))) return 'ollama';
  return `stub:${m.split('-')[0]}`;
}

export class LionProvider implements AIProvider {
  private readonly _cache = new Map<string, AIProvider>();

  constructor(private readonly config: LionProviderConfig) {}

  /** Exposed for testing — returns the resolved (and cached) adapter. */
  public resolveForTest(model: string): AIProvider {
    return this.resolve(model);
  }

  private resolve(model: string): AIProvider {
    const key = adapterKey(model);
    const cached = this._cache.get(key);
    if (cached) return cached;
    const provider = this.create(model);
    this._cache.set(key, provider);
    return provider;
  }

  private create(model: string): AIProvider {
    const m = model.toLowerCase();

    if (m.startsWith('claude-')) {
      if (!this.config.anthropicApiKey)
        throw new Error('LionProvider: anthropicApiKey required for claude-* models');
      return new AnthropicProvider(this.config.anthropicApiKey);
    }

    if (OPENAI_PREFIXES.some((p) => m.startsWith(p))) {
      if (!this.config.openaiApiKey)
        throw new Error('LionProvider: openaiApiKey required for gpt-*/o1-* models');
      return new CodexProvider(this.config.openaiApiKey);
    }

    if (OPENROUTER_PREFIXES.some((p) => m.startsWith(p))) {
      if (!this.config.openrouterApiKey)
        throw new Error(
          'LionProvider: openrouterApiKey required for openrouter/google/groq/mistral/together models'
        );
      return new OpenRouterProvider(this.config.openrouterApiKey);
    }

    if (OLLAMA_PREFIXES.some((p) => m.startsWith(p))) {
      const baseURL = this.config.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL;
      return new CodexProvider('ollama', baseURL);
    }

    if (m.startsWith('gemini-'))
      throw new Error(
        `LionProvider: Google GenAI adapter not yet implemented — use google/ prefix via OpenRouter (model: ${model})`
      );
    if (m.startsWith('zai-'))
      throw new Error(`LionProvider: Z.ai adapter not yet implemented (model: ${model})`);
    if (m.startsWith('groq-'))
      throw new Error(
        `LionProvider: Groq adapter not yet implemented — use groq/ prefix via OpenRouter (model: ${model})`
      );

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
