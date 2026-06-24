import { ProviderConfig } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { DrizzleProviderConfigRepo } from '../provider-config-repo';

import { mockDb } from './mock-db';

const ROW = {
  id: 'user-1::custom1',
  userId: 'user-1',
  providerId: 'custom1',
  displayName: 'Custom LLM',
  protocol: 'openai-compatible' as const,
  baseUrl: 'https://custom/v1',
  apiKeyAccount: 'custom1',
  models: ['model-a'],
  supportsTools: false,
  pricingUrl: null,
  createdAt: new Date(0),
};

describe('DrizzleProviderConfigRepo', () => {
  it('findAll returns empty list when no rows', async () => {
    const { db } = mockDb([]);
    const repo = new DrizzleProviderConfigRepo(db as never);
    const result = await repo.findAll('user-1');
    expect(result).toEqual([]);
  });

  it('findAll maps rows to ProviderConfig objects', async () => {
    const { db } = mockDb([ROW]);
    const repo = new DrizzleProviderConfigRepo(db as never);
    const result = await repo.findAll('user-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('custom1');
    expect(result[0]?.displayName).toBe('Custom LLM');
    expect(result[0]?.models).toEqual(['model-a']);
    expect(result[0]?.supportsTools).toBe(false);
  });

  it('upsert calls insert on the db', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleProviderConfigRepo(db as never);
    const cfg = ProviderConfig.create({
      id: 'custom1',
      displayName: 'Custom LLM',
      protocol: 'openai-compatible',
      baseUrl: 'https://custom/v1',
      apiKeyAccount: 'custom1',
      models: ['model-a'],
      supportsTools: false,
    });
    await repo.upsert('user-1', cfg);
    expect(chain.run).toHaveBeenCalled();
  });

  it('delete calls delete on the db', async () => {
    const { db, chain } = mockDb([]);
    const repo = new DrizzleProviderConfigRepo(db as never);
    await repo.delete('user-1', 'custom1');
    expect(chain.run).toHaveBeenCalled();
  });
});
