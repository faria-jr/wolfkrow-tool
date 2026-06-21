/**
 * Drizzle schema — Vault (secrets metadata, keytar holds values)
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const secretsMetadata = sqliteTable('secrets_metadata', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  key: shortText('key').notNull().unique(),
  displayName: shortText('display_name').notNull(),
  description: text('description'),
  category: text('category', { enum: ['ai', 'integration', 'oauth', 'other'] }).notNull(),
  lastAccessed: timestamp('last_accessed'),
  lastRotated: timestamp('last_rotated'),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
