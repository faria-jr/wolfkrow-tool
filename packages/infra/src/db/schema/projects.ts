/**
 * Drizzle schema — central Projects.
 *
 * A single project registration shared by Harness, Pipeline, OpenDesign,
 * Knowledge and Terminal so `rootPath` / `specPath` and default provider/model
 * config live in one place. Per-workflow project tables (harness_projects,
 * pipeline_projects) remain for their workflow-specific state.
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, shortText } from './base';

export const projects = sqliteTable('projects', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description'),
  rootPath: text('root_path'),
  specPath: text('spec_path'),
  defaultProviderId: text('default_provider_id'),
  defaultPlannerModel: text('default_planner_model'),
  defaultCoderModel: text('default_coder_model'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  status: text('status', { enum: ['active', 'archived'] }).notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
