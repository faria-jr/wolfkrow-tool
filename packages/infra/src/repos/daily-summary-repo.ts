import type { DailySummaryRepo } from '@wolfkrow/domain';
import { DailySummary } from '@wolfkrow/domain';
import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { dailySummaries } from '../db/schema/memory';

type DbRow = typeof dailySummaries.$inferSelect;

function toEntity(row: DbRow): DailySummary {
  return DailySummary.fromProps({
    id: row.id,
    userId: row.userId,
    date: row.date,
    content: row.content,
    sessionCount: row.sessionCount,
    messageCount: row.messageCount,
    tokensUsed: row.tokensUsed,
    cost: row.cost,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt ?? new Date(),
  });
}

export class DrizzleDailySummaryRepo implements DailySummaryRepo {
  constructor(private readonly db = getDb()) {}

  async findByUserIdAndDate(userId: string, date: string): Promise<DailySummary | null> {
    const rows = this.db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.date, date)))
      .all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string, limit?: number): Promise<DailySummary[]> {
    const q = this.db
      .select()
      .from(dailySummaries)
      .where(eq(dailySummaries.userId, userId))
      .orderBy(dailySummaries.date);
    const rows = limit ? q.limit(limit).all() : q.all();
    return rows.map(toEntity);
  }

  async save(summary: DailySummary): Promise<DailySummary> {
    const p = summary.toProps();
    this.db
      .insert(dailySummaries)
      .values({
        id: p.id,
        userId: p.userId,
        date: p.date,
        content: p.content,
        sessionCount: p.sessionCount,
        messageCount: p.messageCount,
        tokensUsed: p.tokensUsed,
        cost: p.cost,
        metadata: p.metadata,
        createdAt: p.createdAt,
      })
      .onConflictDoUpdate({
        target: dailySummaries.id,
        set: {
          content: p.content,
          sessionCount: p.sessionCount,
          messageCount: p.messageCount,
          tokensUsed: p.tokensUsed,
          cost: p.cost,
          metadata: p.metadata,
        },
      })
      .run();
    return summary;
  }
}
