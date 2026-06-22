import { EnrichSession } from '@wolfkrow/domain';
import type { EnrichSessionRepo } from '@wolfkrow/domain';
import type { EnrichMetrics } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { enrichSessions } from '../db/schema/enrich';

import { fromJson, asJsonField } from './json-field';

type DbRow = typeof enrichSessions.$inferSelect;

const EMPTY_METRICS: EnrichMetrics = { tokens: 0, durationMs: 0 };

function toEntity(row: DbRow): EnrichSession {
  return EnrichSession.fromProps({
    id: row.id,
    userId: row.userId,
    specPath: row.specPath,
    status: row.status,
    validatorAgentId: row.validatorAgentId ?? undefined,
    enricherAgentId: row.enricherAgentId ?? undefined,
    validatorMetrics: fromJson<EnrichMetrics>(row.validatorMetrics, EMPTY_METRICS),
    enricherMetrics: fromJson<EnrichMetrics>(row.enricherMetrics, EMPTY_METRICS),
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
      validatorMetrics: asJsonField(p.validatorMetrics),
      enricherMetrics: asJsonField(p.enricherMetrics),
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      metadata: {},
    }).onConflictDoUpdate({
      target: enrichSessions.id,
      set: {
        status: p.status,
        validatorMetrics: asJsonField(p.validatorMetrics),
        enricherMetrics: asJsonField(p.enricherMetrics),
        startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      },
    }).run();
    return session;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(enrichSessions).where(eq(enrichSessions.id, id)).run();
  }
}
