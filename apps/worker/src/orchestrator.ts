/**
 * OrchestratorService — seleciona provider/strategy e executa chat.
 * Routes: request → executor strategy → AIProvider → AsyncIterable<StreamChunk>.
 *
 * A.2: suporte a anthropic|claude-agent|claude-compat|codex|lion|ollama.
 * A.3: message-queue, permission guard, compactação de contexto.
 */

import type { Runtime } from '@wolfkrow/domain';
import { defaultPermissionResolver, getProviderForModel } from '@wolfkrow/domain';
import { ProviderAIProviderFactory } from '@wolfkrow/infra';
import type { AIProvider, AIProviderFactory, CompletionOptions, StreamChunk } from '@wolfkrow/infra';

import { buildAgentSystemPrompt } from './agent-prompt';
import { getRepos, getToolRegistry } from './container';
import { getProviderApiKey, KEYTAR_SERVICE } from './lib/keychain';
import type { Logger } from './logger';


export interface ChatRequest {
 messages: CompletionOptions['messages'];
 model: string;
 provider?: string;
 system?: string;
 maxTokens?: number;
 temperature?: number;
 signal?: AbortSignal;
 /** when set, the persisted Agent drives provider/model/system. */
 agentId?: string;
 userId?: string;
 /** vision image blocks injected into last user message. */
 imageParts?: CompletionOptions['imageParts'];
}

/** Map an Agent's runtime to a provider name . */
const RUNTIME_TO_PROVIDER: Record<Runtime, string> = {
 cloud: 'anthropic',
 codex: 'codex',
 local: 'ollama',
 external: 'anthropic',
 'claude-compat': 'claude-compat',
};

interface AgentRuntimeLike {
 userId: string;
 model: string;
 runtime: Runtime;
 provider: string | undefined;
 systemPrompt: string | undefined;
 skills: string[];
}

function resolveClaudeCompatProvider(model: string, explicitProvider: string | undefined): string {
 if (explicitProvider) return `claude-compat:${explicitProvider}`;

 // P1-5: resolve the preset from the canonical model catalog first.
 const providerId = getProviderForModel(model);
 if (providerId && isClaudeCompatPresetId(providerId)) {
 return `claude-compat:${providerId}`;
 }

 // Prefix fallback for models not catalogued (e.g. newly released variants).
 const m = model.toLowerCase();
 if (m.startsWith('glm-')) return 'claude-compat:zai';
 if (m.startsWith('minimax-')) return 'claude-compat:minimax';
 if (m.startsWith('kimi-')) return 'claude-compat:moonshot';
 if (m.startsWith('qwen-')) return 'claude-compat:qwen';

 throw new Error(
 `Cannot infer claude-compat preset for model "${model}". ` +
 `Set the agent's provider field to one of: zai, minimax, moonshot, qwen.`,
 );
}

function isClaudeCompatPresetId(id: string): id is 'zai' | 'minimax' | 'moonshot' | 'qwen' {
 return id === 'zai' || id === 'minimax' || id === 'moonshot' || id === 'qwen';
}

/**
 * Map a canonical registry provider id to the wire provider name the factory
 * expects. The registry tracks the logical owner (openai, anthropic, ollama);
 * the factory's wire names differ for OpenAI-compatible models ("codex").
 * Claude-compat providers are reached via the agent-runtime path, not here.
 */
function mapRegistryProviderToWire(providerId: string): string {
 switch (providerId) {
 case 'anthropic':
 return 'anthropic';
 case 'openai':
 return 'codex';
 case 'ollama':
 return 'ollama';
 case 'openrouter':
 return 'openrouter';
 default:
 // Unknown / claude-compat provider — let prefix fallback handle it.
 return 'anthropic';
 }
}

/** resolve a persisted Agent → provider/model/system overrides. */
async function resolveAgentRuntime(
 agentId: string,
 requestUserId: string | undefined,
 logger: Logger | undefined,
): Promise<{ provider: string; model: string; system: string } | null> {
 const agent = (await getRepos().agent.findById(agentId)) as AgentRuntimeLike | null;
 if (!agent) return null;
 const userId = requestUserId ?? agent.userId;
 const system = await buildAgentSystemPrompt(agent, userId);
 const baseProvider = RUNTIME_TO_PROVIDER[agent.runtime];
 const provider =
 agent.runtime === 'claude-compat'
 ? resolveClaudeCompatProvider(agent.model, agent.provider)
 : baseProvider;
 logger?.info({ agentId, runtime: agent.runtime, provider }, 'Orchestrator: agent resolved');
 return { provider, model: agent.model, system };
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
 // P1-8: build the factory with the singleton tool registry + permission
 // resolver so the NON-agentic path (resolveProvider → factory.create) wires
 // tools into claude-compat providers instead of silently dropping them.
 // Tests inject a bare factory via options.factory.
 this.factory = options.factory ?? new ProviderAIProviderFactory(getToolRegistry(), defaultPermissionResolver);
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
 ...(effective.imageParts?.length ? { imageParts: effective.imageParts } : {}),
 });
 }

 /**
 * when the request carries an agentId, resolve the persisted Agent
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
 // P1-5: prefer the canonical model catalog. Known models resolve to their
 // registered provider; only unknown models fall back to prefix inference.
 const catalogProvider = getProviderForModel(model);
 if (catalogProvider) return mapRegistryProviderToWire(catalogProvider);

 const m = model.toLowerCase();
 if (m.startsWith('claude-')) return 'anthropic';
 if (m.startsWith('gpt-') || m.startsWith('o1-') || m.startsWith('o3-')) return 'codex';
 if (m.startsWith('llama-') || m.startsWith('qwen') || m.startsWith('phi-')) return 'ollama';
 return 'anthropic';
 }

 private async loadApiKey(provider: string): Promise<string> {
 return getProviderApiKey(provider, this.keytarService);
 }
}
