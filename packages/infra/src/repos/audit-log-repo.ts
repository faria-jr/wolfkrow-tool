import { randomUUID } from 'crypto';

import type { AuditEntryInput, AuditFilter, AuditRepo, AuditRow } from '@wolfkrow/domain';
import { and, desc, eq, gte } from 'drizzle-orm';

import { getDb } from '../db/client';
import { auditLog } from '../db/schema';

/** Drizzle enum da coluna `action` (interno — a fronteira do domínio usa `string`). */
type AuditAction = (typeof auditLog.$inferInsert)['action'];

/**
 * Audit-log repository via Drizzle (SQLite). Implementa o port `AuditRepo` do
 * domínio (antes o contrato vivia em use-cases e esta classe não o
 * implementava — a rota fazia `as never`).
 */
export class DrizzleAuditLogRepo implements AuditRepo {
  constructor(private readonly db = getDb()) {}

  insert(entry: AuditEntryInput): void {
    this.db
      .insert(auditLog)
      .values({
        id: randomUUID(),
        userId: entry.userId,
        action: entry.action as AuditAction,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata as never,
        ip: entry.ip ?? null,
        timestamp: entry.timestamp,
      })
      .run();
  }

  findMany(filter: AuditFilter): AuditRow[] {
    const conds = [eq(auditLog.userId, filter.userId)];
    if (filter.action) conds.push(eq(auditLog.action, filter.action as AuditAction));
    if (filter.resourceType) conds.push(eq(auditLog.resourceType, filter.resourceType));
    if (filter.since) conds.push(gte(auditLog.timestamp, filter.since));

    const rows = this.db
      .select()
      .from(auditLog)
      .where(and(...conds))
      .orderBy(desc(auditLog.timestamp))
      .limit(filter.limit ?? 200)
      .all();

    return rows.map(this.toRow);
  }

  private toRow = (r: typeof auditLog.$inferSelect): AuditRow => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId ?? undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    ip: r.ip ?? undefined,
    timestamp: r.timestamp,
  });
}
