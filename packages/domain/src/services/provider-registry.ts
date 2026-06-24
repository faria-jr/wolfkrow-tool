import { ProviderConfig } from '../value-objects/provider-config';

export const BUILT_IN_PROVIDERS: ProviderConfig[] = [
 ProviderConfig.create({
 id: 'anthropic',
 displayName: 'Anthropic (Claude)',
 protocol: 'anthropic-compat',
 baseUrl: 'https://api.anthropic.com',
 apiKeyAccount: 'anthropic',
 models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'zai',
 displayName: 'Z.ai (GLM)',
 protocol: 'anthropic-compat',
 baseUrl: 'https://api.z.ai/api/anthropic',
 apiKeyAccount: 'zai-api-key',
 models: ['glm-4.7', 'glm-4.5-air', 'glm-5.1', 'glm-5-turbo'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'minimax',
 displayName: 'MiniMax TokenPlan',
 protocol: 'anthropic-compat',
 baseUrl: 'https://api.minimax.io/anthropic',
 apiKeyAccount: 'minimax-api-key',
 models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M3'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'moonshot',
 displayName: 'Moonshot (Kimi)',
 protocol: 'anthropic-compat',
 baseUrl: 'https://api.moonshot.cn/anthropic',
 apiKeyAccount: 'moonshot-api-key',
 models: ['kimi-k2', 'kimi-k2-0711', 'kimi-k1.5'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'qwen',
 displayName: 'Qwen (DashScope)',
 protocol: 'anthropic-compat',
 baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/anthropic',
 apiKeyAccount: 'qwen-api-key',
 models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'openrouter',
 displayName: 'OpenRouter',
 protocol: 'openai-compatible',
 baseUrl: 'https://openrouter.ai/api/v1',
 apiKeyAccount: 'openrouter',
 models: ['openrouter/auto'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'openai',
 displayName: 'OpenAI',
 protocol: 'openai-compatible',
 baseUrl: 'https://api.openai.com/v1',
 apiKeyAccount: 'openai',
 models: ['gpt-4o', 'gpt-4.1', 'o3'],
 supportsTools: true,
 }),
 ProviderConfig.create({
 id: 'ollama',
 displayName: 'Ollama (local)',
 protocol: 'openai-compatible',
 baseUrl: 'http://localhost:11434/v1',
 apiKeyAccount: 'ollama',
 models: ['llama3', 'qwen3', 'mistral'],
 supportsTools: false,
 }),
];

export function mergeProviders(builtIn: ProviderConfig[], custom: ProviderConfig[]): ProviderConfig[] {
 const map = new Map(builtIn.map((p) => [p.id, p]));
 for (const c of custom) map.set(c.id, c);
 return [...map.values()];
}

export function getProviderById(list: ProviderConfig[], id: string): ProviderConfig | undefined {
 return list.find((p) => p.id === id);
}
