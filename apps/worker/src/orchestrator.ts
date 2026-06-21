/**
 * OrchestratorService — seleciona provider/strategy e executa chat.
 * Routes: request → executor strategy → AIProvider → AsyncIterable<StreamChunk>.
 *
 * A.2: suporte a anthropic|claude-agent|claude-compat|codex|lion|ollama.
 * A.3: message-queue, permission guard, compactação de contexto.
 */

import { aiProviderFactory } from '@wolfkrow/infra';
import type { AIProvider, AIProviderFactory, CompletionOptions, StreamChunk } from '@wolfkrow/infra';
import keytar from 'keytar';

import type { Logger } from './logger';

const KEYTAR_SERVICE = 'wolfkrow';
const KEYTAR_ACCOUNT_MAP: Record<string, string> = {
  anthropic: 'anthropic-api-key',
  'claude-agent': 'anthropic-api-key',
  'claude-compat': 'anthropic-api-key',
  codex: 'openai-api-key',
  openai: 'openai-api-key',
  lion: 'anthropic-api-key',
  ollama: 'ollama-api-key',
  mock: '',
};

export interface ChatRequest {
  messages: CompletionOptions['messages'];
  model: string;
  provider?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface OrchestratorOptions {
  logger?: Logger;
  factory?: AIProviderFactory;
  keytarService?: string;
}

export class OrchestratorService {
  private readonly logger: Logger | undefined;
  private readonly factory: AIProviderFactory;
  private readonly keytarService: string;

  constructor(options: OrchestratorOptions = {}) {
    this.logger = options.logger;
    this.factory = options.factory ?? aiProviderFactory;
    this.keytarService = options.keytarService ?? KEYTAR_SERVICE;
  }

  async *stream(request: ChatRequest): AsyncIterable<StreamChunk> {
    const provider = await this.resolveProvider(request);
    yield* provider.query({
      model: request.model,
      messages: request.messages,
      ...(request.system !== undefined ? { system: request.system } : {}),
      ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.signal !== undefined ? { signal: request.signal } : {}),
    });
  }

  private async resolveProvider(request: ChatRequest): Promise<AIProvider> {
    const providerName = request.provider ?? this.inferProvider(request.model);
    const apiKey = await this.loadApiKey(providerName);
    this.logger?.info({ provider: providerName, model: request.model }, 'Orchestrator: resolving provider');
    return this.factory.create(providerName, apiKey);
  }

  private inferProvider(model: string): string {
    const m = model.toLowerCase();
    if (m.startsWith('claude-')) return 'anthropic';
    if (m.startsWith('gpt-') || m.startsWith('o1-') || m.startsWith('o3-')) return 'codex';
    if (m.startsWith('llama-') || m.startsWith('qwen') || m.startsWith('phi-')) return 'ollama';
    return 'anthropic';
  }

  private async loadApiKey(provider: string): Promise<string> {
    if (provider === 'mock') return '';
    if (provider === 'ollama') return 'ollama';
    const account = KEYTAR_ACCOUNT_MAP[provider] ?? `${provider}-api-key`;
    const key = await keytar.getPassword(this.keytarService, account);
    if (!key) throw new Error(`Missing API key in keychain: ${this.keytarService}/${account}`);
    return key;
  }
}
