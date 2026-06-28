import { ProviderConfig } from '@wolfkrow/domain';
import type { ProviderProtocol } from '@wolfkrow/domain';
import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { providerConfigs } from '../db/schema/providers';

type Db = ReturnType<typeof getDb>;
type ProviderConfigRow = typeof providerConfigs.$inferSelect;

export class DrizzleProviderConfigRepo {
  constructor(private readonly db: Db = getDb()) {}

  async findAll(userId: string): Promise<ProviderConfig[]> {
    const rows = this.db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.userId, userId))
      .all();
    return rows.map((r) => this.toConfig(r));
  }

  async upsert(userId: string, config: ProviderConfig): Promise<void> {
    const row = {
      id: `${userId}::${config.id}`,
      userId,
      providerId: config.id,
      displayName: config.displayName,
      protocol: config.protocol,
      baseUrl: config.baseUrl,
      apiKeyAccount: config.apiKeyAccount,
      models: [...config.models],
      supportsTools: config.supportsTools,
      ...(config.pricingUrl !== undefined ? { pricingUrl: config.pricingUrl } : {}),
    };
    this.db
      .insert(providerConfigs)
      .values(row)
      .onConflictDoUpdate({
        target: providerConfigs.id,
        set: {
          displayName: row.displayName,
          protocol: row.protocol,
          baseUrl: row.baseUrl,
          apiKeyAccount: row.apiKeyAccount,
          models: row.models,
          supportsTools: row.supportsTools,
          ...(config.pricingUrl !== undefined ? { pricingUrl: config.pricingUrl } : {}),
        },
      })
      .run();
  }

  async delete(userId: string, id: string): Promise<void> {
    this.db
      .delete(providerConfigs)
      .where(and(eq(providerConfigs.userId, userId), eq(providerConfigs.providerId, id)))
      .run();
  }

  private toConfig(r: ProviderConfigRow): ProviderConfig {
    return ProviderConfig.create({
      id: r.providerId,
      displayName: r.displayName,
      protocol: r.protocol as ProviderProtocol,
      baseUrl: r.baseUrl,
      apiKeyAccount: r.apiKeyAccount,
      models: r.models,
      supportsTools: r.supportsTools,
      ...(r.pricingUrl !== null ? { pricingUrl: r.pricingUrl } : {}),
    });
  }
}
