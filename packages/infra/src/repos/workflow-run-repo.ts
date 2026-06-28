import { WorkflowRun } from '@wolfkrow/domain';
import type { WorkflowMetrics, WorkflowRunRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { workflowRuns } from '../db/schema/workflow';

import { fromJson, asJsonField } from './json-field';

type DbRow = typeof workflowRuns.$inferSelect;

function toEntity(row: DbRow): WorkflowRun {
  return WorkflowRun.fromProps({
    id: row.id,
    userId: row.userId,
    workflowName: row.workflowName,
    status: row.status,
    input: fromJson<Record<string, unknown>>(row.input, {}),
    output:
      fromJson<Record<string, unknown>>(
        row.output,
        undefined as unknown as Record<string, unknown>
      ) ?? undefined,
    error: row.error ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    metrics: fromJson<WorkflowMetrics>(row.metrics, { durationMs: 0, stepCount: 0 }),
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
    this.db
      .insert(workflowRuns)
      .values({
        id: p.id,
        userId: p.userId,
        workflowName: p.workflowName,
        status: p.status,
        input: asJsonField(p.input),
        output: asJsonField(p.output),
        error: p.error ?? null,
        startedAt: p.startedAt ?? null,
        completedAt: p.completedAt ?? null,
        metrics: asJsonField(p.metrics),
        metadata: {},
        createdAt: p.createdAt,
      })
      .onConflictDoUpdate({
        target: workflowRuns.id,
        set: {
          status: p.status,
          output: asJsonField(p.output),
          error: p.error ?? null,
          startedAt: p.startedAt ?? null,
          completedAt: p.completedAt ?? null,
          metrics: asJsonField(p.metrics),
        },
      })
      .run();
    return run;
  }
}
