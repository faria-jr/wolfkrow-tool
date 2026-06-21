import { randomUUID } from 'crypto';
import { and, desc, eq, gte } from 'drizzle-orm';

import { getDb } from '../db/client';
import { auditLog } from '../db/schema';

export type AuditAction = typeof auditLog.$inferInsert['action'];

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string | undefined;
  metadata: Record<string, unknown>;
  ip: string | undefined;
  timestamp: Date;
}

export interface AuditFilter {
  userId: string;
  action?: AuditAction;
  resourceType?: string;
  since?: Date;
  limit?: number;
}

export class DrizzleAuditLogRepo {
  constructor(private readonly db = getDb()) {}

  insert(entry: Omit<AuditEntry, 'id'>): void {
    this.db
      .insert(auditLog)
      .values({
        id: randomUUID(),
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata as never,
        ip: entry.ip ?? null,
        timestamp: entry.timestamp,
      })
      .run();
  }

  findMany(filter: AuditFilter): AuditEntry[] {
    const conds = [eq(auditLog.userId, filter.userId)];
    if (filter.action) conds.push(eq(auditLog.action, filter.action));
    if (filter.resourceType) conds.push(eq(auditLog.resourceType, filter.resourceType));
    if (filter.since) conds.push(gte(auditLog.timestamp, filter.since));

    const rows = this.db
      .select()
      .from(auditLog)
      .where(and(...conds))
      .orderBy(desc(auditLog.timestamp))
      .limit(filter.limit ?? 200)
      .all();

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      ip: r.ip ?? undefined,
      timestamp: r.timestamp,
    }));
  }
}
