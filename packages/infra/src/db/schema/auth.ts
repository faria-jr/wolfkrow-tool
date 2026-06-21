/**
 * Drizzle schema — Auth tables (users, sessions, audit)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { id, timestamp, metadata } from './base';

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').unique(),
  displayName: text('display_name'),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner'] }).notNull().default('owner'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  totpSecret: text('totp_secret'),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  lastLogin: timestamp('last_login'),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const authAuditLog = sqliteTable(
  'auth_audit_log',
  {
    id: id(),
    userId: text('user_id').references(() => users.id),
    action: text('action', {
      enum: [
        'login.success',
        'login.fail',
        'totp.success',
        'totp.fail',
        'logout',
        'lock',
        'unlock',
        'totp.enable',
        'totp.disable',
        'password.change',
      ],
    }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    metadata: metadata(),
    timestamp: timestamp('timestamp').notNull(),
  },
  (t) => ({
    userIdIdx: index('auth_audit_log_user_id_idx').on(t.userId),
    timestampIdx: index('auth_audit_log_timestamp_idx').on(t.timestamp),
  }),
);
