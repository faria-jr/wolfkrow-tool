import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const providerConfigs = sqliteTable(
  'provider_configs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    providerId: text('provider_id').notNull(),
    displayName: text('display_name').notNull(),
    protocol: text('protocol').notNull(),
    baseUrl: text('base_url').notNull(),
    apiKeyAccount: text('api_key_account').notNull(),
    models: text('models', { mode: 'json' }).notNull().$type<string[]>(),
    supportsTools: integer('supports_tools', { mode: 'boolean' }).notNull().default(false),
    pricingUrl: text('pricing_url'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byUser: index('provider_configs_user_idx').on(t.userId),
    byUserProvider: index('provider_configs_user_provider_idx').on(t.userId, t.providerId),
    userProviderUnique: uniqueIndex('provider_configs_user_provider_uq').on(t.userId, t.providerId),
  })
);
