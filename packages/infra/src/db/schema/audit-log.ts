/**
 * Drizzle schema — Audit log (comprehensive trail)
 */

import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const auditLog = sqliteTable('audit_log', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  action: text('action', {
    enum: [
      'agent.create',
      'agent.update',
      'agent.delete',
      'agent.sync',
      'skill.create',
      'skill.update',
      'skill.delete',
      'mcp.start',
      'mcp.stop',
      'mcp.restart',
      'secret.create',
      'secret.update',
      'secret.delete',
      'secret.access',
      'pipeline.create',
      'pipeline.start',
      'pipeline.pause',
      'pipeline.resume',
      'pipeline.complete',
      'pipeline.cancel',
      'harness.create',
      'harness.start',
      'harness.pause',
      'harness.complete',
      'knowledge.ingest',
      'knowledge.delete',
      'memory.compact',
      'session.archive',
      'session.delete',
    ],
  }).notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  metadata: metadata(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull(),
},
(t) => ({
  userIdIdx: index('audit_log_user_id_idx').on(t.userId),
  timestampIdx: index('audit_log_timestamp_idx').on(t.timestamp),
  actionIdx: index('audit_log_action_idx').on(t.action),
}));
