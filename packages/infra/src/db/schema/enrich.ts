/**
 * Drizzle schema — Enrich (Validator→Enricher sessions and messages)
 */

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const enrichSessions = sqliteTable('enrich_sessions', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  specPath: text('spec_path').notNull(),
  status: text('status', {
    enum: ['pending', 'validator', 'enricher', 'completed', 'cancelled'],
  }).notNull(),
  validatorAgentId: text('validator_agent_id'),
  enricherAgentId: text('enricher_agent_id'),
  validatorMetrics: metadata(),
  enricherMetrics: metadata(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metadata: metadata(),
});

export const enrichMessages = sqliteTable('enrich_messages', {
  id: id(),
  sessionId: text('session_id')
    .notNull()
    .references(() => enrichSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'validator', 'enricher', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
