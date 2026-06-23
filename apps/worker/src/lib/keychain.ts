import keytar from 'keytar';

export const KEYTAR_SERVICE = 'wolfkrow';

const ACCOUNT_MAP: Record<string, string> = {
  anthropic: 'anthropic-api-key',
  'claude-agent': 'anthropic-api-key',
  'claude-compat': 'anthropic-api-key',
  codex: 'openai-api-key',
  openai: 'openai-api-key',
  lion: 'anthropic-api-key',
  ollama: 'ollama-api-key',
  openrouter: 'openrouter-api-key',
};

export async function getProviderApiKey(provider: string, service = KEYTAR_SERVICE): Promise<string> {
  if (provider === 'mock') return '';
  if (provider === 'ollama') return 'ollama';
  const account = ACCOUNT_MAP[provider] ?? `${provider}-api-key`;
  const key = await keytar.getPassword(service, account);
  if (!key) throw new Error(`Missing API key in keychain: ${service}/${account}`);
  return key;
}
