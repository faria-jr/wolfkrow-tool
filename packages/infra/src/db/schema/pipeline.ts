/**
 * Drizzle schema — Pipeline (BuildPlan projects, phases, messages)
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const pipelineProjects = sqliteTable('pipeline_projects', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description'),
  currentStage: text('current_stage', {
    enum: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed'],
  }).notNull(),
  status: text('status', {
    enum: ['running', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled'],
  }).notNull(),
  discoveryNotes: text('discovery_notes'),
  specPath: text('spec_path'),
  prdPath: text('prd_path'),
  approvalNotes: text('approval_notes'),
  specEdits: text('spec_edits'),
  harnessProjectId: text('harness_project_id'),
  metrics: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  completedAt: timestamp('completed_at'),
});

export const pipelinePhases = sqliteTable('pipeline_phases', {
  id: id(),
  projectId: text('project_id')
    .notNull()
    .references(() => pipelineProjects.id, { onDelete: 'cascade' }),
  stage: text('stage', {
    enum: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'in_progress', 'awaiting_user', 'completed', 'failed', 'skipped'],
  }).notNull(),
  artifactPath: text('artifact_path'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metrics: metadata(),
});

export const pipelineMessages = sqliteTable('pipeline_messages', {
  id: id(),
  projectId: text('project_id')
    .notNull()
    .references(() => pipelineProjects.id, { onDelete: 'cascade' }),
  phaseId: text('phase_id')
    .notNull()
    .references(() => pipelinePhases.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
