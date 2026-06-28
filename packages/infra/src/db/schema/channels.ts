/**
 * Drizzle schema — Channels (Telegram, Discord, Slack integrations)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const channels = sqliteTable('channels', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['telegram', 'discord', 'slack', 'whatsapp'] }).notNull(),
  name: shortText('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status', {
    enum: ['connected', 'disconnected', 'error', 'pairing'],
  })
    .notNull()
    .default('disconnected'),
  config: metadata(),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error'),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const channelPairings = sqliteTable('channel_pairings', {
  id: id(),
  channelType: text('channel_type', {
    enum: ['telegram', 'discord', 'slack', 'whatsapp'],
  }).notNull(),
  code: text('code').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
