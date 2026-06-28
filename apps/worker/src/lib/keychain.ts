import keytar from 'keytar';

export const KEYTAR_SERVICE = 'wolfkrow';

const ACCOUNT_MAP: Record<string, string> = {
  anthropic: 'anthropic-api-key',
  'claude-agent': 'anthropic-api-key',
  'claude-compat': 'anthropic-api-key',
  zai: 'zai-api-key',
  minimax: 'minimax-api-key',
  moonshot: 'moonshot-api-key',
  qwen: 'qwen-api-key',
  codex: 'openai-api-key',
  openai: 'openai-api-key',
  lion: 'anthropic-api-key',
  ollama: 'ollama-api-key',
  openrouter: 'openrouter-api-key',
};

export async function getProviderApiKey(
  provider: string,
  service = KEYTAR_SERVICE
): Promise<string> {
  if (provider === 'mock') return '';
  if (provider === 'ollama') return 'ollama';
  const normalized = provider.toLowerCase();
  const lookupKey = normalized.startsWith('claude-compat:')
    ? normalized.slice('claude-compat:'.length)
    : normalized;
  const account = ACCOUNT_MAP[lookupKey] ?? `${lookupKey}-api-key`;
  const key = await keytar.getPassword(service, account);
  if (!key) throw new Error(`Missing API key in keychain: ${service}/${account}`);
  return key;
}

/** Convenience wrapper for the most common provider (used by pipeline + enrich). */
export async function getAnthropicApiKey(): Promise<string> {
  return getProviderApiKey('anthropic');
}

/**
 * Generic keychain read by account name (e.g. `telegram-bot-token`).
 * Returns null when absent — callers decide how to handle a missing secret.
 * Use {@link getProviderApiKey} for provider API keys (it throws + maps accounts).
 */
export async function getSecret(account: string, service = KEYTAR_SERVICE): Promise<string | null> {
  return keytar.getPassword(service, account);
}
