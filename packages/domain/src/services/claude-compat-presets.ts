/**
 * Claude-compat presets — DERIVED from the canonical {@link BUILT_IN_PROVIDERS}
 * registry (P1-5). There is no longer a second copy of baseUrl/apiKeyAccount/
 * models here; presets are a filtered view of the registry's anthropic-compat
 * providers.
 */

import { BUILT_IN_PROVIDERS, getProviderById } from './provider-registry';

export const CLAUDE_COMPAT_PROVIDER_IDS = ['zai', 'minimax', 'moonshot', 'qwen'] as const;

export type ClaudeCompatProviderId = (typeof CLAUDE_COMPAT_PROVIDER_IDS)[number];

export interface ClaudeCompatPreset {
  readonly id: ClaudeCompatProviderId;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly apiKeyAccount: string;
  readonly models: readonly string[];
}

function presetFromRegistry(id: ClaudeCompatProviderId): ClaudeCompatPreset {
  const provider = getProviderById(BUILT_IN_PROVIDERS, id);
  if (!provider) {
    throw new Error(`Claude-compat preset "${id}" missing from provider-registry`);
  }
  return {
    id,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    apiKeyAccount: provider.apiKeyAccount,
    models: provider.models,
  };
}

export const CLAUDE_COMPAT_PRESETS: Record<ClaudeCompatProviderId, ClaudeCompatPreset> = {
  zai: presetFromRegistry('zai'),
  minimax: presetFromRegistry('minimax'),
  moonshot: presetFromRegistry('moonshot'),
  qwen: presetFromRegistry('qwen'),
};

export function isClaudeCompatProviderId(value: string): value is ClaudeCompatProviderId {
  return CLAUDE_COMPAT_PROVIDER_IDS.includes(value as ClaudeCompatProviderId);
}

export function getClaudeCompatPreset(id: string): ClaudeCompatPreset {
  if (!isClaudeCompatProviderId(id)) {
    throw new Error(`Unknown Claude-compat provider: ${id}`);
  }
  return CLAUDE_COMPAT_PRESETS[id];
}
