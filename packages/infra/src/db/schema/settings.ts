/**
 * Drizzle schema — Settings (single-user, single-row pattern)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const settings = sqliteTable('settings', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme', { enum: ['light', 'dark', 'system'] }).notNull().default('system'),
  orchestrator: metadata(),
  voice: metadata(),
  stt: metadata(),
  compaction: metadata(),
  telemetry: integer('telemetry', { mode: 'boolean' }).notNull().default(false),
  autoLaunch: integer('auto_launch', { mode: 'boolean' }).notNull().default(false),
  autoLockMinutes: integer('auto_lock_minutes').notNull().default(5),
  metadata: metadata(),
  updatedAt: timestamp('updated_at').notNull(),
});
