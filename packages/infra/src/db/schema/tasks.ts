/**
 * Drizzle schema — Tasks (kanban/calendar task management)
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const tasks = sqliteTable('tasks', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: shortText('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['todo', 'in_progress', 'blocked', 'done', 'cancelled'],
  })
    .notNull()
    .default('todo'),
  category: text('category', {
    enum: ['work', 'personal', 'learning', 'health', 'finance', 'other'],
  })
    .notNull()
    .default('personal'),
  priority: text('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  })
    .notNull()
    .default('medium'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
