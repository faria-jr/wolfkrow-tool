/**
 * AI provider factory — Strategy selection (§1.5 O).
 * Novos SDKs = novo case, zero edição nos callers.
 */

import type { PermissionResolver } from '@wolfkrow/domain';

import type { ToolRegistry } from '../tools/tool-registry';

import { AnthropicProvider } from './anthropic';
import { ClaudeAgentProvider } from './claude-agent';
import { ClaudeCompatProvider } from './claude-compat';
import { CodexProvider } from './codex';
import { LionProvider } from './lion';
import { MockProvider } from './mock';
import { OpenRouterProvider } from './openrouter';
import type { AIProvider, AIProviderFactory } from './types';

const CLAUDE_COMPAT_PREFIX = 'claude-compat:';

function isClaudeCompatPrefixed(provider: string): boolean {
  return provider.toLowerCase().startsWith(CLAUDE_COMPAT_PREFIX);
}

function extractClaudeCompatPreset(provider: string): string {
  return provider.slice(CLAUDE_COMPAT_PREFIX.length);
}

function createSimpleProvider(
  normalized: string,
  apiKey: string,
  toolRegistry: ToolRegistry | undefined,
  permissionResolver: PermissionResolver | undefined,
): AIProvider | undefined {
  switch (normalized) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'claude-agent':
      return new ClaudeAgentProvider(apiKey, toolRegistry, permissionResolver);
    case 'claude-compat':
      throw new Error(
        'Provider "claude-compat" requires a preset suffix — use "claude-compat:zai", ' +
        '"claude-compat:minimax", "claude-compat:moonshot", or "claude-compat:qwen".',
      );
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
      return undefined;
  }
}

export class ProviderAIProviderFactory implements AIProviderFactory {
  constructor(
    private readonly toolRegistry?: ToolRegistry,
    private readonly permissionResolver?: PermissionResolver,
  ) {}

  create(provider: string, apiKey: string): AIProvider {
    const normalized = provider.toLowerCase();

    if (isClaudeCompatPrefixed(normalized)) {
      const presetId = extractClaudeCompatPreset(normalized);
      return new ClaudeCompatProvider(apiKey, presetId);
    }

    const simple = createSimpleProvider(normalized, apiKey, this.toolRegistry, this.permissionResolver);
    if (simple) return simple;

    throw new Error(`Unsupported AI provider: ${provider}`);
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
export {
  CLAUDE_COMPAT_PRESETS,
  CLAUDE_COMPAT_PROVIDER_IDS,
  getClaudeCompatPreset,
  isClaudeCompatProviderId,
} from '@wolfkrow/domain';
export type { ClaudeCompatPreset, ClaudeCompatProviderId } from '@wolfkrow/domain';
