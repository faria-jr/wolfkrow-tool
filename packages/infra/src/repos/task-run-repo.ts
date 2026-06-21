import type { TaskRunRepo } from '@wolfkrow/domain';
import { TaskRun } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { taskRuns } from '../db/schema/scheduler';

type DbRow = typeof taskRuns.$inferSelect;

function toEntity(row: DbRow): TaskRun {
  return TaskRun.fromProps({
    id: row.id,
    taskId: row.taskId,
    status: row.status,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    output: (row.output ?? undefined) as Record<string, unknown> | undefined,
    error: row.error ?? undefined,
    reviewNote: row.reviewNote ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    metrics: (row.metrics ?? undefined) as { tokens?: number; cost?: number; durationMs?: number; toolUses?: number } | undefined,
  });
}

export class DrizzleTaskRunRepo implements TaskRunRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<TaskRun | null> {
    const rows = this.db.select().from(taskRuns).where(eq(taskRuns.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByTaskId(taskId: string, limit?: number): Promise<TaskRun[]> {
    const q = this.db.select().from(taskRuns).where(eq(taskRuns.taskId, taskId));
    const rows = limit ? q.limit(limit).all() : q.all();
    return rows.map(toEntity);
  }

  async save(run: TaskRun): Promise<TaskRun> {
    const p = run.toProps();
    this.db.insert(taskRuns).values({
      id: p.id, taskId: p.taskId, status: p.status,
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      output: (p.output ?? null) as Record<string, unknown> | null,
      error: p.error ?? null, reviewNote: p.reviewNote ?? null,
      reviewedAt: p.reviewedAt ?? null,
      metrics: (p.metrics ?? null) as { tokens?: number; cost?: number; durationMs?: number; toolUses?: number } | null,
    }).onConflictDoUpdate({
      target: taskRuns.id,
      set: {
        status: p.status, completedAt: p.completedAt ?? null,
        output: (p.output ?? null) as Record<string, unknown> | null,
        error: p.error ?? null, reviewNote: p.reviewNote ?? null,
        reviewedAt: p.reviewedAt ?? null,
        metrics: (p.metrics ?? null) as { tokens?: number; cost?: number; durationMs?: number; toolUses?: number } | null,
      },
    }).run();
    return run;
  }
}
