import { HarnessSprint } from '@wolfkrow/domain';
import type { HarnessSprintRepo } from '@wolfkrow/domain';
import type { SprintFeature, SprintMetrics } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { harnessSprints } from '../db/schema/harness';


type DbRow = typeof harnessSprints.$inferSelect;

function toEntity(row: DbRow): HarnessSprint {
  return HarnessSprint.fromProps({
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    features: row.features as SprintFeature[],
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    metrics: row.metrics as unknown as SprintMetrics,
  });
}

export class DrizzleHarnessSprintRepo implements HarnessSprintRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<HarnessSprint | null> {
    const rows = this.db.select().from(harnessSprints).where(eq(harnessSprints.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByProjectId(projectId: string): Promise<HarnessSprint[]> {
    const rows = this.db.select().from(harnessSprints).where(eq(harnessSprints.projectId, projectId)).all();
    return rows.map(toEntity);
  }

  async save(sprint: HarnessSprint): Promise<HarnessSprint> {
    const p = sprint.toProps();
    this.db.insert(harnessSprints).values({
      id: p.id, projectId: p.projectId, number: p.number, name: p.name,
      description: p.description ?? null, status: p.status,
      features: p.features as unknown[],
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      metrics: p.metrics as unknown as Record<string, unknown>,
    }).onConflictDoUpdate({
      target: harnessSprints.id,
      set: {
        status: p.status, features: p.features as unknown[],
        startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
        metrics: p.metrics as unknown as Record<string, unknown>,
      },
    }).run();
    return sprint;
  }
}
