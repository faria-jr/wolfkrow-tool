import {
  ANTHROPIC_BUILTIN_ID,
  BUILT_IN_PROVIDERS,
  getProviderById,
  getProviderForModel,
  isClaudeCompatProviderId,
  mergeProviders,
  type ProviderConfig,
} from '@wolfkrow/domain';
import type { AIProvider, AIProviderFactory } from '@wolfkrow/infra';

import { getAdapters, getRepos } from '../container';

import { getProviderApiKey, KEYTAR_SERVICE } from './keychain';

const CLAUDE_COMPAT_PREFIX = 'claude-compat:';
const MODEL_PROVIDER_PREFIXES: readonly [prefix: string, providerId: string][] = [
  ['gpt-', 'openai'],
  ['o1-', 'openai'],
  ['o3-', 'openai'],
  ['o4-', 'openai'],
  ['llama-', 'ollama'],
  ['phi-', 'ollama'],
  ['glm-', 'zai'],
  ['minimax-', 'minimax'],
  ['kimi-', 'moonshot'],
  ['qwen-', 'qwen'],
];

export interface ResolvedProvider {
  config: ProviderConfig;
  apiKey: string;
  provider: AIProvider;
}

export interface ResolveProviderInput {
  providerId?: string | undefined;
  model?: string | undefined;
  userId?: string | undefined;
  factory?: AIProviderFactory | undefined;
  keytarService?: string | undefined;
}

function normalizeProviderId(providerId: string | undefined): string | undefined {
  if (!providerId) return undefined;
  const normalized = providerId.toLowerCase();
  if (normalized.startsWith(CLAUDE_COMPAT_PREFIX))
    return normalized.slice(CLAUDE_COMPAT_PREFIX.length);
  if (normalized === 'codex') return 'openai';
  if (normalized === 'claude-agent') return ANTHROPIC_BUILTIN_ID;
  if (isClaudeCompatProviderId(normalized)) return normalized;
  return normalized;
}

function inferProviderId(model: string | undefined): string {
  if (!model) return ANTHROPIC_BUILTIN_ID;
  const catalogProvider = getProviderForModel(model);
  if (catalogProvider) return catalogProvider;

  const m = model.toLowerCase();
  return (
    MODEL_PROVIDER_PREFIXES.find(([prefix]) => m.startsWith(prefix))?.[1] ?? ANTHROPIC_BUILTIN_ID
  );
}

export async function listProviderConfigs(userId: string | undefined): Promise<ProviderConfig[]> {
  if (!userId) return BUILT_IN_PROVIDERS;
  const repo = getRepos().providerConfig;
  if (!repo) return BUILT_IN_PROVIDERS;
  const custom = await repo.findAll(userId);
  return mergeProviders(BUILT_IN_PROVIDERS, custom);
}

export async function resolveProviderConfigForRequest(
  input: ResolveProviderInput
): Promise<ProviderConfig> {
  const requested = normalizeProviderId(input.providerId) ?? inferProviderId(input.model);
  const providers = await listProviderConfigs(input.userId);
  return getProviderById(providers, requested) ?? getProviderById(providers, ANTHROPIC_BUILTIN_ID)!;
}

async function resolveApiKey(config: ProviderConfig, keytarService: string): Promise<string> {
  try {
    const fromConfiguredAccount = await getAdapters().secrets.get(config.apiKeyAccount);
    if (fromConfiguredAccount) return fromConfiguredAccount;
  } catch {
    // Some tests and legacy worker paths mock only the keychain. Fall back to
    // the historical provider-id lookup below.
  }
  return getProviderApiKey(config.id, keytarService);
}

export async function resolveAIProvider(input: ResolveProviderInput): Promise<ResolvedProvider> {
  const config = await resolveProviderConfigForRequest(input);
  const apiKey = await resolveApiKey(config, input.keytarService ?? KEYTAR_SERVICE);
  const factory = input.factory ?? getAdapters().aiFactory;
  return {
    config,
    apiKey,
    provider: factory.createFromConfig(config, apiKey),
  };
}
