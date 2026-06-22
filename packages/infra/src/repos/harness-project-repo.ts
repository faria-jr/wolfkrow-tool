import { HarnessProject } from '@wolfkrow/domain';
import type { HarnessProjectRepo } from '@wolfkrow/domain';
import type { HarnessConfig, ProjectMetrics } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { harnessProjects } from '../db/schema/harness';


type DbRow = typeof harnessProjects.$inferSelect;

function toEntity(row: DbRow): HarnessProject {
  return HarnessProject.fromProps({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    specPath: row.specPath,
    status: row.status,
    config: row.config as unknown as HarnessConfig,
    metrics: row.metrics as unknown as ProjectMetrics,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? undefined,
  });
}

export class DrizzleHarnessProjectRepo implements HarnessProjectRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<HarnessProject | null> {
    const rows = this.db.select().from(harnessProjects).where(eq(harnessProjects.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<HarnessProject[]> {
    const rows = this.db.select().from(harnessProjects).where(eq(harnessProjects.userId, userId)).all();
    return rows.map(toEntity);
  }

  async save(project: HarnessProject): Promise<HarnessProject> {
    const p = project.toProps();
    this.db.insert(harnessProjects).values({
      id: p.id, userId: p.userId, name: p.name,
      description: p.description ?? null, specPath: p.specPath, status: p.status,
      config: p.config as unknown as Record<string, unknown>,
      metrics: p.metrics as unknown as Record<string, unknown>,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      completedAt: p.completedAt ?? null,
    }).onConflictDoUpdate({
      target: harnessProjects.id,
      set: {
        name: p.name, description: p.description ?? null, status: p.status,
        config: p.config as unknown as Record<string, unknown>,
        metrics: p.metrics as unknown as Record<string, unknown>,
        updatedAt: p.updatedAt, completedAt: p.completedAt ?? null,
      },
    }).run();
    return project;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(harnessProjects).where(eq(harnessProjects.id, id)).run();
  }
}
