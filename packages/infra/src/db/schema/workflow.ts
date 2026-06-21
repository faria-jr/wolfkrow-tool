/**
 * Drizzle schema — Workflow (generic workflow runs)
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const workflowRuns = sqliteTable('workflow_runs', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workflowName: shortText('workflow_name').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  input: metadata(),
  output: metadata(),
  error: text('error'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metrics: metadata(),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
});
