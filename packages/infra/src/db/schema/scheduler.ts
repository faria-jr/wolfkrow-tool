/**
 * Drizzle schema — Scheduler (cron tasks, runs)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const scheduledTasks = sqliteTable(
  'scheduled_tasks',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: shortText('name').notNull(),
    description: text('description'),
    cronExpression: text('cron_expression').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    prompt: text('prompt').notNull(),
    agentId: text('agent_id'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    config: metadata(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('scheduled_tasks_user_id_idx').on(t.userId),
    enabledNextRunIdx: index('scheduled_tasks_enabled_next_run_idx').on(t.enabled, t.nextRunAt),
  }),
);

export const taskRuns = sqliteTable(
  'task_runs',
  {
    id: id(),
    taskId: text('task_id')
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'running', 'awaiting_review', 'validated', 'rejected'],
    }).notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    output: text('output', { mode: 'json' }),
    error: text('error'),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at'),
    metrics: text('metrics', { mode: 'json' }).$type<{
      tokens?: number;
      cost?: number;
      durationMs?: number;
      toolUses?: number;
    }>(),
  },
  (t) => ({
    taskIdIdx: index('task_runs_task_id_idx').on(t.taskId),
    statusIdx: index('task_runs_status_idx').on(t.status),
  }),
);
