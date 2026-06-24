/**
 * Claude-compat presets — value object + catalog for providers that expose an
 * Anthropic-compatible messages API (Z.ai/GLM, MiniMax TokenPlan, Moonshot/Kimi,
 * Qwen/DashScope).
 *
 * Domain puro: não depende de SDKs de infraestrutura.
 */

export const CLAUDE_COMPAT_PROVIDER_IDS = ['zai', 'minimax', 'moonshot', 'qwen'] as const;

export type ClaudeCompatProviderId = (typeof CLAUDE_COMPAT_PROVIDER_IDS)[number];

export interface ClaudeCompatPreset {
  readonly id: ClaudeCompatProviderId;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly apiKeyAccount: string;
  readonly models: readonly string[];
}

export const CLAUDE_COMPAT_PRESETS: Record<ClaudeCompatProviderId, ClaudeCompatPreset> = {
  zai: {
    id: 'zai',
    displayName: 'Z.ai (GLM)',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKeyAccount: 'zai-api-key',
    models: ['glm-4.7', 'glm-4.5-air', 'glm-5.1', 'glm-5-turbo'],
  },
  minimax: {
    id: 'minimax',
    displayName: 'MiniMax TokenPlan',
    baseUrl: 'https://api.minimax.io/anthropic',
    apiKeyAccount: 'minimax-api-key',
    models: [
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M3',
    ],
  },
  moonshot: {
    id: 'moonshot',
    displayName: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    apiKeyAccount: 'moonshot-api-key',
    models: ['kimi-k2', 'kimi-k2-0711', 'kimi-k1.5'],
  },
  qwen: {
    id: 'qwen',
    displayName: 'Qwen (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/anthropic',
    apiKeyAccount: 'qwen-api-key',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
  },
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
