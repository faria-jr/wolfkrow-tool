import { Project } from '@wolfkrow/domain';
import type { ProjectRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { projects } from '../db/schema/projects';

import { fromJson } from './json-field';

type DbRow = typeof projects.$inferSelect;
type ProjectRow = typeof projects.$inferInsert;

function toRow(p: ReturnType<Project['toProps']>): ProjectRow {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description ?? null,
    rootPath: p.rootPath ?? null,
    specPath: p.specPath ?? null,
    defaultProviderId: p.defaultProviderId ?? null,
    defaultPlannerModel: p.defaultPlannerModel ?? null,
    defaultCoderModel: p.defaultCoderModel ?? null,
    tags: [...p.tags],
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toEntity(row: DbRow): Project {
  return Project.fromProps({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    rootPath: row.rootPath ?? undefined,
    specPath: row.specPath ?? undefined,
    defaultProviderId: row.defaultProviderId ?? undefined,
    defaultPlannerModel: row.defaultPlannerModel ?? undefined,
    defaultCoderModel: row.defaultCoderModel ?? undefined,
    tags: fromJson<string[]>(row.tags, []),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleProjectRepo implements ProjectRepo {
  constructor(private readonly db = getDb()) {}

  async findAll(): Promise<Project[]> {
    const rows = this.db.select().from(projects).all();
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<Project | null> {
    const rows = this.db.select().from(projects).where(eq(projects.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async save(project: Project): Promise<Project> {
    const row = toRow(project.toProps());
    const { id: _id, userId: _userId, createdAt: _createdAt, ...settable } = row;
    this.db
      .insert(projects)
      .values(row)
      .onConflictDoUpdate({ target: projects.id, set: settable })
      .run();
    return project;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(projects).where(eq(projects.id, id)).run();
  }
}
