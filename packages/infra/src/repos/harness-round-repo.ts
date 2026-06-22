import { HarnessRound } from '@wolfkrow/domain';
import type { HarnessRoundRepo } from '@wolfkrow/domain';
import type { RoundMetrics } from '@wolfkrow/domain';
import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { harnessRounds } from '../db/schema/harness';

import { fromJsonRequired, asJsonField } from './json-field';

type DbRow = typeof harnessRounds.$inferSelect;

function toEntity(row: DbRow): HarnessRound {
  return HarnessRound.fromProps({
    id: row.id,
    sprintId: row.sprintId,
    featureIndex: row.featureIndex,
    roundNumber: row.roundNumber,
    status: row.status,
    coderOutput: row.coderOutput ?? undefined,
    evaluatorFeedback: row.evaluatorFeedback ?? undefined,
    metrics: fromJsonRequired<RoundMetrics>(row.metrics),
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  });
}

export class DrizzleHarnessRoundRepo implements HarnessRoundRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<HarnessRound | null> {
    const rows = this.db.select().from(harnessRounds).where(eq(harnessRounds.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findBySprintId(sprintId: string): Promise<HarnessRound[]> {
    const rows = this.db.select().from(harnessRounds).where(eq(harnessRounds.sprintId, sprintId)).all();
    return rows.map(toEntity);
  }

  async findBySprintAndFeature(sprintId: string, featureIndex: number): Promise<HarnessRound[]> {
    const rows = this.db.select().from(harnessRounds)
      .where(and(eq(harnessRounds.sprintId, sprintId), eq(harnessRounds.featureIndex, featureIndex)))
      .all();
    return rows.map(toEntity);
  }

  async save(round: HarnessRound): Promise<HarnessRound> {
    const p = round.toProps();
    this.db.insert(harnessRounds).values({
      id: p.id, sprintId: p.sprintId, featureIndex: p.featureIndex, roundNumber: p.roundNumber,
      status: p.status, coderOutput: p.coderOutput ?? null, evaluatorFeedback: p.evaluatorFeedback ?? null,
      metrics: asJsonField(p.metrics),
      startedAt: p.startedAt, completedAt: p.completedAt ?? null,
    }).onConflictDoUpdate({
      target: harnessRounds.id,
      set: {
        status: p.status, coderOutput: p.coderOutput ?? null,
        evaluatorFeedback: p.evaluatorFeedback ?? null,
        metrics: asJsonField(p.metrics),
        completedAt: p.completedAt ?? null,
      },
    }).run();
    return round;
  }
}
