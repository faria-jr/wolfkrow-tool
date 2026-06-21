import type { WorkflowRunRepo } from '@wolfkrow/domain';
import { WorkflowRun } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { workflowRuns } from '../db/schema/workflow';
import type { WorkflowMetrics } from '@wolfkrow/domain';

type DbRow = typeof workflowRuns.$inferSelect;

function toEntity(row: DbRow): WorkflowRun {
  return WorkflowRun.fromProps({
    id: row.id,
    userId: row.userId,
    workflowName: row.workflowName,
    status: row.status,
    input: (row.input as Record<string, unknown>) ?? {},
    output: (row.output as Record<string, unknown>) ?? undefined,
    error: row.error ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    metrics: (row.metrics as unknown as WorkflowMetrics) ?? { durationMs: 0, stepCount: 0 },
    createdAt: row.createdAt,
  });
}

export class DrizzleWorkflowRunRepo implements WorkflowRunRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<WorkflowRun | null> {
    const rows = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string, limit?: number): Promise<WorkflowRun[]> {
    const q = this.db.select().from(workflowRuns).where(eq(workflowRuns.userId, userId));
    const rows = limit ? q.limit(limit).all() : q.all();
    return rows.map(toEntity);
  }

  async save(run: WorkflowRun): Promise<WorkflowRun> {
    const p = run.toProps();
    this.db.insert(workflowRuns).values({
      id: p.id, userId: p.userId, workflowName: p.workflowName, status: p.status,
      input: p.input, output: p.output ?? {}, error: p.error ?? null,
      startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
      metrics: p.metrics as unknown as Record<string, unknown>,
      metadata: {}, createdAt: p.createdAt,
    }).onConflictDoUpdate({
      target: workflowRuns.id,
      set: {
        status: p.status, output: p.output ?? {}, error: p.error ?? null,
        startedAt: p.startedAt ?? null, completedAt: p.completedAt ?? null,
        metrics: p.metrics as unknown as Record<string, unknown>,
      },
    }).run();
    return run;
  }
}
