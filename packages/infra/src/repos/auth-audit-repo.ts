import { randomUUID } from 'node:crypto';

import { getDb } from '../db/client';
import { authAuditLog } from '../db/schema/auth';

export type AuthAuditAction = typeof authAuditLog.$inferInsert['action'];

export interface AuthAuditEntry {
  userId: string | undefined;
  action: AuthAuditAction;
  ip: string | undefined;
  userAgent: string | undefined;
}

export class DrizzleAuthAuditRepo {
  constructor(private readonly db = getDb()) {}

  log(entry: AuthAuditEntry): void {
    this.db
      .insert(authAuditLog)
      .values({
        id: randomUUID(),
        userId: entry.userId ?? null,
        action: entry.action,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: {},
        timestamp: new Date(),
      })
      .run();
  }
}
