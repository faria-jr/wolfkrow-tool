/**
 * OrchestratorService — seleciona provider/strategy e executa chat.
 * Routes: request → executor strategy → AIProvider → AsyncIterable<StreamChunk>.
 *
 * A.2: suporte a anthropic|claude-agent|claude-compat|codex|lion|ollama.
 * A.3: message-queue, permission guard, compactação de contexto.
 */

import type { Runtime } from '@wolfkrow/domain';
import { aiProviderFactory } from '@wolfkrow/infra';
import type { AIProvider, AIProviderFactory, CompletionOptions, StreamChunk } from '@wolfkrow/infra';
import keytar from 'keytar';

import { buildAgentSystemPrompt } from './agent-prompt';
import { getRepos } from './container';
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
  /** FIX-005: when set, the persisted Agent drives provider/model/system. */
  agentId?: string;
  userId?: string;
}

/** Map an Agent's runtime to a provider name (FIX-005). */
const RUNTIME_TO_PROVIDER: Record<Runtime, string> = {
  cloud: 'anthropic',
  codex: 'codex',
  local: 'ollama',
  external: 'anthropic',
};

interface AgentRuntimeLike {
  userId: string;
  model: string;
  runtime: Runtime;
  systemPrompt: string | undefined;
  skills: string[];
}

/** FIX-005: resolve a persisted Agent → provider/model/system overrides. */
async function resolveAgentRuntime(
  agentId: string,
  requestUserId: string | undefined,
  logger: Logger | undefined,
): Promise<{ provider: string; model: string; system: string } | null> {
  const agent = (await getRepos().agent.findById(agentId)) as AgentRuntimeLike | null;
  if (!agent) return null;
  const userId = requestUserId ?? agent.userId;
  const system = await buildAgentSystemPrompt(agent, userId);
  logger?.info({ agentId, runtime: agent.runtime }, 'Orchestrator: agent resolved');
  return { provider: RUNTIME_TO_PROVIDER[agent.runtime], model: agent.model, system };
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
    const effective = await this.applyAgent(request);
    const provider = await this.resolveProvider(effective);
    yield* provider.query({
      model: effective.model,
      messages: effective.messages,
      ...(effective.system !== undefined ? { system: effective.system } : {}),
      ...(effective.maxTokens !== undefined ? { maxTokens: effective.maxTokens } : {}),
      ...(effective.temperature !== undefined ? { temperature: effective.temperature } : {}),
      ...(effective.signal !== undefined ? { signal: effective.signal } : {}),
    });
  }

  /**
   * FIX-005: when the request carries an agentId, resolve the persisted Agent
   * and let it drive provider (from runtime), model, and the composed system
   * prompt. Returns the request unchanged when no agent is selected.
   */
  private async applyAgent(request: ChatRequest): Promise<ChatRequest> {
    if (!request.agentId) return request;
    const resolved = await resolveAgentRuntime(request.agentId, request.userId, this.logger);
    return resolved ? { ...request, ...resolved } : request;
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
