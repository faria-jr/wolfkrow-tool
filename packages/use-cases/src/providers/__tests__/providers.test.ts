import { ProviderConfig } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { DeleteProviderUseCase } from '../delete-provider';
import { ListProvidersUseCase } from '../list-providers';
import { SaveProviderUseCase } from '../save-provider';

function makeFakeRepo(initial: ProviderConfig[] = []) {
  const store = new Map<string, ProviderConfig>(initial.map((p) => [p.id, p]));
  return {
    findAll: async (_userId: string) => [...store.values()],
    upsert: async (_userId: string, config: ProviderConfig) => { store.set(config.id, config); },
    delete: async (_userId: string, id: string) => { store.delete(id); },
  };
}

describe('providers use-cases', () => {
  it('list merges built-in + custom, built-ins always present', async () => {
    const repo = makeFakeRepo([]);
    const uc = new ListProvidersUseCase(repo);
    const out = await uc.execute({ userId: 'u1' });
    const ids = out.providers.map((p) => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('zai');
    expect(ids).toContain('ollama');
  });

  it('list includes custom providers on top of built-ins', async () => {
    const custom = ProviderConfig.create({
      id: 'custom1', displayName: 'Custom', protocol: 'openai-compatible',
      baseUrl: 'https://c/v1', apiKeyAccount: 'c1', models: ['m1'], supportsTools: false,
    });
    const repo = makeFakeRepo([custom]);
    const uc = new ListProvidersUseCase(repo);
    const out = await uc.execute({ userId: 'u1' });
    const ids = out.providers.map((p) => p.id);
    expect(ids).toContain('custom1');
    expect(ids).toContain('anthropic');
  });

  it('save persists a custom provider', async () => {
    const repo = makeFakeRepo([]);
    const uc = new SaveProviderUseCase(repo);
    await uc.execute({
      userId: 'u1',
      config: {
        id: 'c1', displayName: 'C1', protocol: 'openai-compatible',
        baseUrl: 'https://c/v1', apiKeyAccount: 'c1', models: ['m1'], supportsTools: false,
      },
    });
    const all = await repo.findAll('u1');
    expect(all.map((p) => p.id)).toContain('c1');
  });

  it('save validates via ProviderConfig.create — rejects empty models', async () => {
    const repo = makeFakeRepo([]);
    const uc = new SaveProviderUseCase(repo);
    await expect(
      uc.execute({
        userId: 'u1',
        config: {
          id: 'bad', displayName: 'Bad', protocol: 'openai-compatible',
          baseUrl: 'https://b/v1', apiKeyAccount: 'bad', models: [], supportsTools: false,
        },
      }),
    ).rejects.toThrow('at least one model');
  });

  it('delete removes a custom provider', async () => {
    const custom = ProviderConfig.create({
      id: 'custom1', displayName: 'C', protocol: 'openai-compatible',
      baseUrl: 'https://c/v1', apiKeyAccount: 'c1', models: ['m1'], supportsTools: false,
    });
    const repo = makeFakeRepo([custom]);
    const uc = new DeleteProviderUseCase(repo);
    await uc.execute({ userId: 'u1', id: 'custom1' });
    const all = await repo.findAll('u1');
    expect(all.map((p) => p.id)).not.toContain('custom1');
  });

  it('delete rejects built-in provider (anthropic)', async () => {
    const repo = makeFakeRepo([]);
    const uc = new DeleteProviderUseCase(repo);
    await expect(uc.execute({ userId: 'u1', id: 'anthropic' })).rejects.toThrow(/Cannot delete built-in/);
  });

  it('delete rejects built-in provider (zai)', async () => {
    const repo = makeFakeRepo([]);
    const uc = new DeleteProviderUseCase(repo);
    await expect(uc.execute({ userId: 'u1', id: 'zai' })).rejects.toThrow(/Cannot delete built-in/);
  });

  it('delete of unknown id is a no-op (idempotent)', async () => {
    const repo = makeFakeRepo([]);
    const uc = new DeleteProviderUseCase(repo);
    await expect(uc.execute({ userId: 'u1', id: 'does-not-exist' })).resolves.toBeUndefined();
  });
});
