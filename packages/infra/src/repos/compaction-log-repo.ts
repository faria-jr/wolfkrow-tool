import type { CompactionLogRepo } from '@wolfkrow/domain';
import { CompactionLog } from '@wolfkrow/domain';
import { desc, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { compactionLog } from '../db/schema/memory';

type DbRow = typeof compactionLog.$inferSelect;

function toEntity(row: DbRow): CompactionLog {
  return CompactionLog.fromProps({
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId ?? null,
    trigger: row.trigger as CompactionLog['trigger'],
    beforeTokens: row.beforeTokens,
    afterTokens: row.afterTokens,
    tokensSaved: row.tokensSaved,
    summary: row.summary ?? null,
    createdAt: row.createdAt ?? new Date(),
  });
}

export class DrizzleCompactionLogRepo implements CompactionLogRepo {
  constructor(private readonly db = getDb()) {}

  async findByUserId(userId: string, limit = 50): Promise<CompactionLog[]> {
    const q = this.db
      .select()
      .from(compactionLog)
      .where(eq(compactionLog.userId, userId))
      .orderBy(desc(compactionLog.createdAt));
    const rows = limit ? q.limit(limit).all() : q.all();
    return rows.map(toEntity);
  }

  async save(log: CompactionLog): Promise<CompactionLog> {
    const p = log.toProps();
    this.db
      .insert(compactionLog)
      .values({
        id: p.id,
        userId: p.userId,
        sessionId: p.sessionId,
        trigger: p.trigger,
        beforeTokens: p.beforeTokens,
        afterTokens: p.afterTokens,
        tokensSaved: p.tokensSaved,
        summary: p.summary,
        createdAt: p.createdAt,
      })
      .run();
    return log;
  }
}
