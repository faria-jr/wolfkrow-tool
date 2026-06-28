import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProviderApiKey, getSecret } from '../keychain';

const mockKeytar = vi.hoisted(() => ({ getPassword: vi.fn() }));
vi.mock('keytar', () => ({ default: mockKeytar }));

describe('getProviderApiKey', () => {
  beforeEach(() => {
    mockKeytar.getPassword.mockReset();
  });

  it('returns empty string for mock provider without calling keytar', async () => {
    await expect(getProviderApiKey('mock')).resolves.toBe('');
    expect(mockKeytar.getPassword).not.toHaveBeenCalled();
  });

  it('returns "ollama" for ollama provider without calling keytar', async () => {
    await expect(getProviderApiKey('ollama')).resolves.toBe('ollama');
    expect(mockKeytar.getPassword).not.toHaveBeenCalled();
  });

  it('reads anthropic key from wolfkrow/anthropic-api-key', async () => {
    mockKeytar.getPassword.mockResolvedValue('sk-ant-test');
    await expect(getProviderApiKey('anthropic')).resolves.toBe('sk-ant-test');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('wolfkrow', 'anthropic-api-key');
  });

  it('throws with clear message when key missing', async () => {
    mockKeytar.getPassword.mockResolvedValue(null);
    await expect(getProviderApiKey('anthropic')).rejects.toThrow(
      'Missing API key in keychain: wolfkrow/anthropic-api-key'
    );
  });

  it('uses custom service name when provided', async () => {
    mockKeytar.getPassword.mockResolvedValue('test-key');
    await getProviderApiKey('anthropic', 'my-service');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('my-service', 'anthropic-api-key');
  });

  it('reads preset key for claude-compat prefixed provider', async () => {
    mockKeytar.getPassword.mockResolvedValue('zai-key');
    await expect(getProviderApiKey('claude-compat:zai')).resolves.toBe('zai-key');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('wolfkrow', 'zai-api-key');
  });

  it('reads preset key for claude-compat prefixed provider regardless of case', async () => {
    mockKeytar.getPassword.mockResolvedValue('qwen-key');
    await expect(getProviderApiKey('CLAUDE-COMPAT:qwen')).resolves.toBe('qwen-key');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('wolfkrow', 'qwen-api-key');
  });

  it('derives account name for unknown providers', async () => {
    mockKeytar.getPassword.mockResolvedValue('test-key');
    await getProviderApiKey('myprovider');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('wolfkrow', 'myprovider-api-key');
  });
});

describe('getSecret', () => {
  beforeEach(() => {
    mockKeytar.getPassword.mockReset();
  });

  it('returns the stored secret for an account name', async () => {
    mockKeytar.getPassword.mockResolvedValue('bot-token-123');
    await expect(getSecret('telegram-bot-token')).resolves.toBe('bot-token-123');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('wolfkrow', 'telegram-bot-token');
  });

  it('returns null when the secret is absent (no throw)', async () => {
    mockKeytar.getPassword.mockResolvedValue(null);
    await expect(getSecret('missing')).resolves.toBeNull();
  });

  it('honors a custom service name', async () => {
    mockKeytar.getPassword.mockResolvedValue('k');
    await getSecret('x', 'alt-service');
    expect(mockKeytar.getPassword).toHaveBeenCalledWith('alt-service', 'x');
  });
});
