import { ProviderConfig } from '@wolfkrow/domain';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthFastifyInstance } from '../../types/fastify';
import { providerRoutes } from '../providers';

const { mockProviderConfigRepo, mockSecrets } = vi.hoisted(() => ({
  mockProviderConfigRepo: {
    findAll: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  mockSecrets: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../container', () => ({
  getRepos: vi.fn().mockReturnValue({
    providerConfig: mockProviderConfigRepo,
  }),
  getAdapters: vi.fn().mockReturnValue({
    secrets: mockSecrets,
  }),
}));

async function buildApp() {
  const app = Fastify();
  await app.register(async (instance) => {
    instance.decorate('authenticate', async () => {});
    await providerRoutes(instance as AuthFastifyInstance);
  });
  await app.ready();
  return app;
}

describe('GET /providers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockProviderConfigRepo.findAll.mockReset();
    mockSecrets.get.mockReset();
    app = await buildApp();
  });

  it('returns merged providers list with hasApiKey flags', async () => {
    const custom = ProviderConfig.create({
      id: 'custom1',
      displayName: 'Custom 1',
      protocol: 'anthropic-compat',
      baseUrl: 'https://api.example.com',
      apiKeyAccount: 'custom1',
      models: ['m'],
      supportsTools: true,
    });
    mockProviderConfigRepo.findAll.mockResolvedValue([custom]);
    mockSecrets.get.mockImplementation(async (account: string) =>
      account === 'custom1' ? 'secret' : null
    );

    const res = await app.inject({ method: 'GET', url: '/providers' });
    expect(res.statusCode).toBe(200);
    // F5.1 — paginated envelope.
    const parsed = JSON.parse(res.body) as { items: { id: string; hasApiKey: boolean }[] };
    const body = parsed.items;
    expect(body.some((p) => p.id === 'anthropic')).toBe(true);
    const customRow = body.find((p) => p.id === 'custom1');
    expect(customRow).toBeDefined();
    expect(customRow?.hasApiKey).toBe(true);
    const builtIn = body.find((p) => p.id === 'anthropic');
    expect(builtIn?.hasApiKey).toBe(false);
  });
});

describe('POST /providers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockProviderConfigRepo.upsert.mockReset();
    mockSecrets.set.mockReset();
    app = await buildApp();
  });

  it('saves provider and stores apiKey when provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/providers',
      payload: {
        id: 'myprovider',
        displayName: 'My Provider',
        protocol: 'anthropic-compat',
        baseUrl: 'https://api.example.com',
        apiKeyAccount: 'myaccount',
        models: ['m1'],
        supportsTools: true,
        apiKey: 'secret-key',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(mockProviderConfigRepo.upsert).toHaveBeenCalledOnce();
    expect(mockSecrets.set).toHaveBeenCalledWith('myaccount', 'secret-key');
  });

  it('saves provider without storing apiKey when omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/providers',
      payload: {
        id: 'myprovider',
        displayName: 'My Provider',
        protocol: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyAccount: 'myaccount',
        models: ['gpt-4o'],
        supportsTools: false,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(mockSecrets.set).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/providers',
      payload: { id: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /providers/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockProviderConfigRepo.delete.mockReset();
    app = await buildApp();
  });

  it('calls repo delete with userId and id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/providers/custom1' });
    expect(res.statusCode).toBe(204);
    expect(mockProviderConfigRepo.delete).toHaveBeenCalledWith('anonymous', 'custom1');
  });
});
