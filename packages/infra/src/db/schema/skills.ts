/**
 * Drizzle schema — Skills (Markdown instructions with frontmatter)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText, longText } from './base';

export const skills = sqliteTable('skills', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description').notNull(),
  content: longText('content').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  version: text('version').notNull().default('1.0.0'),
  author: text('author'),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
