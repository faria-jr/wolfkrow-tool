/**
 * Drizzle schema — Harness (projects, sprints, rounds)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const harnessProjects = sqliteTable('harness_projects', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description'),
  specPath: text('spec_path').notNull(),
  projectPath: text('project_path'),
  status: text('status', {
    enum: ['planning', 'ready', 'running', 'paused', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  config: metadata(),
  metrics: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  completedAt: timestamp('completed_at'),
});

export const harnessSprints = sqliteTable('harness_sprints', {
  id: id(),
  projectId: text('project_id')
    .notNull()
    .references(() => harnessProjects.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: shortText('name').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  }).notNull(),
  features: text('features', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metrics: metadata(),
});

export const harnessRounds = sqliteTable('harness_rounds', {
  id: id(),
  sprintId: text('sprint_id')
    .notNull()
    .references(() => harnessSprints.id, { onDelete: 'cascade' }),
  featureIndex: integer('feature_index').notNull(),
  roundNumber: integer('round_number').notNull(),
  status: text('status', {
    enum: ['coder_running', 'evaluator_running', 'passed', 'failed', 'max_rounds_reached'],
  }).notNull(),
  coderOutput: text('coder_output'),
  evaluatorFeedback: text('evaluator_feedback'),
  metrics: metadata(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
});
