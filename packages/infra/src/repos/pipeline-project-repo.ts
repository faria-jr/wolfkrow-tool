import { PipelineProject } from '@wolfkrow/domain';
import type { PipelineProjectRepo } from '@wolfkrow/domain';
import type { PipelineMetrics } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { pipelineProjects } from '../db/schema/pipeline';

import { fromJson, asJsonField } from './json-field';

type DbRow = typeof pipelineProjects.$inferSelect;
type PipelineProjectRow = typeof pipelineProjects.$inferInsert;

const EMPTY_METRICS: PipelineMetrics = { totalTokens: 0, totalCost: 0, phasesCompleted: 0, durationMs: 0 };

function toRow(p: ReturnType<PipelineProject['toProps']>): PipelineProjectRow {
  return {
    id: p.id, userId: p.userId, name: p.name, description: p.description ?? null,
    currentStage: p.currentStage, status: p.status,
    discoveryNotes: p.discoveryNotes ?? null, specPath: p.specPath ?? null,
    prdPath: p.prdPath ?? null, approvalNotes: p.approvalNotes ?? null,
    metrics: asJsonField(p.metrics),
    createdAt: p.createdAt, updatedAt: p.updatedAt, completedAt: p.completedAt ?? null,
  };
}

function toEntity(row: DbRow): PipelineProject {
  return PipelineProject.fromProps({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    currentStage: row.currentStage,
    status: row.status,
    discoveryNotes: row.discoveryNotes ?? undefined,
    specPath: row.specPath ?? undefined,
    prdPath: row.prdPath ?? undefined,
    approvalNotes: row.approvalNotes ?? undefined,
    metrics: fromJson<PipelineMetrics>(row.metrics, EMPTY_METRICS),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  });
}

export class DrizzlePipelineProjectRepo implements PipelineProjectRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<PipelineProject | null> {
    const rows = this.db.select().from(pipelineProjects).where(eq(pipelineProjects.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<PipelineProject[]> {
    const rows = this.db.select().from(pipelineProjects).where(eq(pipelineProjects.userId, userId)).all();
    return rows.map(toEntity);
  }

  async save(project: PipelineProject): Promise<PipelineProject> {
    const row = toRow(project.toProps());
    const { id: _id, userId: _userId, createdAt: _createdAt, ...settable } = row;
    this.db.insert(pipelineProjects).values(row)
      .onConflictDoUpdate({ target: pipelineProjects.id, set: settable })
      .run();
    return project;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(pipelineProjects).where(eq(pipelineProjects.id, id)).run();
  }
}
