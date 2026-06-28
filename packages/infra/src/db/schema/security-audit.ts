/**
 * Drizzle schema — Security audits (RM8)
 *
 * Stores scan runs and individual findings emitted by the security
 * audit runner.
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const securityScans = sqliteTable(
  'security_scans',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectPath: text('project_path').notNull(),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    summary: metadata(),
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at'),
    error: text('error'),
  },
  (t) => ({
    userIdx: index('security_scans_user_idx').on(t.userId),
    statusIdx: index('security_scans_status_idx').on(t.status),
  })
);

export const securityFindings = sqliteTable(
  'security_findings',
  {
    id: id(),
    scanId: text('scan_id')
      .notNull()
      .references(() => securityScans.id, { onDelete: 'cascade' }),
    severity: text('severity', {
      enum: ['info', 'warning', 'major', 'critical', 'blocker'],
    }).notNull(),
    dimension: text('dimension').notNull(),
    file: text('file').notNull(),
    line: integer('line'),
    message: text('message').notNull(),
    rule: text('rule'),
    agentId: text('agent_id'),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    scanIdx: index('security_findings_scan_idx').on(t.scanId),
    severityIdx: index('security_findings_severity_idx').on(t.severity),
  })
);
