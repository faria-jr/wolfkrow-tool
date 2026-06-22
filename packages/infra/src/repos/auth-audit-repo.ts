import { randomUUID } from 'node:crypto';

import type { AuthAuditEntry, AuthAuditRepo } from '@wolfkrow/domain';

import { getDb } from '../db/client';
import { authAuditLog } from '../db/schema/auth';

/** Drizzle enum da coluna `action` (interno — a fronteira do domínio usa `string`). */
type AuthAuditAction = typeof authAuditLog.$inferInsert['action'];

/**
 * Auth-audit repository via Drizzle (SQLite). Implementa o port `AuthAuditRepo`
 * do domínio (FIX-027: tipos eram inline em infra).
 */
export class DrizzleAuthAuditRepo implements AuthAuditRepo {
  constructor(private readonly db = getDb()) {}

  log(entry: AuthAuditEntry): void {
    this.db
      .insert(authAuditLog)
      .values({
        id: randomUUID(),
        userId: entry.userId ?? null,
        action: entry.action as AuthAuditAction,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: {},
        timestamp: new Date(),
      })
      .run();
  }
}
