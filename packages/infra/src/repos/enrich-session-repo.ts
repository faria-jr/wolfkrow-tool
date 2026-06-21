import type { EnrichSessionRepo } from '@wolfkrow/domain';
import { EnrichSession } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { enrichSessions } from '../db/schema/enrich';
import type { EnrichMetrics } from '@wolfkrow/domain';

type DbRow = typeof enrichSessions.$inferSelect;

function toEntity(row: DbRow): EnrichSession {
  return EnrichSession.fromProps({
    id: row.id,
    userId: row.userId,
    specPath: row.specPath,
    status: row.status,
    validatorAgentId: row.validatorAgentId ?? undefined,
    enricherAgentId: row.enricherAgentId ?? undefined,
    validatorMetrics: (row.validatorMetrics as unknown as EnrichMetrics) ?? { tokens: 0, durationMs: 0 },
    enricherMetrics: (row.enricherMetrics as unknown as EnrichMetrics) ?? { tokens: 0, durationMs: 0 },
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
  });
}

export class DrizzleEnrichSessionRepo implements EnrichSessionRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<EnrichSession | null> {
    const rows = this.db.select().from(enrichSessions).where(eq(enrichSessions.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<EnrichSession[]> {
    const rows = this.db.select().from(enrichSessions).where(eq(enrichSessions.userId, userId)).all();
    return rows.map(toEntity);
  }

  async save(session: EnrichSession): Promise<EnrichSession> {
    const p = session.toProps();
    this.db.insert(enrichSessions).values({
      id: p.id, userId: p.userId, specPath: p.specPath, status: p.status,
      validatorAgentId: p.validatorAgentId ?? null, enricherAgentId: p.enricherAgentId ?? null,
      validatorMetrics: p.validatorMetrics as unknown as Record<string, unknown>,
      enricherMetrics: p.enricherMetrics as unknown as Record<string, unknown>,
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      metadata: {},
    }).onConflictDoUpdate({
      target: enrichSessions.id,
      set: {
        status: p.status,
        validatorMetrics: p.validatorMetrics as unknown as Record<string, unknown>,
        enricherMetrics: p.enricherMetrics as unknown as Record<string, unknown>,
        startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      },
    }).run();
    return session;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(enrichSessions).where(eq(enrichSessions.id, id)).run();
  }
}
