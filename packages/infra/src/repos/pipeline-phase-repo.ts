import { PipelinePhase } from '@wolfkrow/domain';
import type { PipelinePhaseRepo } from '@wolfkrow/domain';
import type { PhaseMetrics } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { pipelinePhases } from '../db/schema/pipeline';

import { fromJson, asJsonField } from './json-field';

type DbRow = typeof pipelinePhases.$inferSelect;
type PhaseDbStage = typeof pipelinePhases.$inferInsert['stage'];

function toEntity(row: DbRow): PipelinePhase {
  return PipelinePhase.fromProps({
    id: row.id,
    projectId: row.projectId,
    stage: row.stage,
    status: row.status,
    artifactPath: row.artifactPath ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    metrics: fromJson<PhaseMetrics>(row.metrics, { tokens: 0, cost: 0, durationMs: 0 }),
  });
}

export class DrizzlePipelinePhaseRepo implements PipelinePhaseRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<PipelinePhase | null> {
    const rows = this.db.select().from(pipelinePhases).where(eq(pipelinePhases.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByProjectId(projectId: string): Promise<PipelinePhase[]> {
    const rows = this.db.select().from(pipelinePhases).where(eq(pipelinePhases.projectId, projectId)).all();
    return rows.map(toEntity);
  }

  async save(phase: PipelinePhase): Promise<PipelinePhase> {
    const p = phase.toProps();
    this.db.insert(pipelinePhases).values({
      id: p.id, projectId: p.projectId, stage: p.stage as PhaseDbStage, status: p.status,
      artifactPath: p.artifactPath ?? null,
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      metrics: asJsonField(p.metrics),
    }).onConflictDoUpdate({
      target: pipelinePhases.id,
      set: {
        status: p.status, artifactPath: p.artifactPath ?? null,
        startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
        metrics: asJsonField(p.metrics),
      },
    }).run();
    return phase;
  }
}
