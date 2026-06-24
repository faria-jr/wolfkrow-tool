import { and, eq, lte } from 'drizzle-orm';

import { getDb } from '../db/client';
import { scheduledTasks, taskRuns } from '../db/schema/scheduler';

type Db = ReturnType<typeof getDb>;
type ScheduledTaskRow = typeof scheduledTasks.$inferSelect;

export interface CreateRunInput {
  id: string;
  taskId: string;
  status: 'pending' | 'running' | 'awaiting_review' | 'validated' | 'rejected';
  startedAt: Date;
  output?: Record<string, unknown>;
  error?: string;
}

export interface CompleteRunInput {
  status: 'awaiting_review' | 'validated' | 'rejected';
  completedAt: Date;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ISchedulerRepository {
  findEnabledTasksDueBy(now: Date): ScheduledTaskRow[];
  updateNextRun(taskId: string, nextRunAt: Date): unknown;
  disable(taskId: string): unknown;
  createRun(values: CreateRunInput): unknown;
  completeRun(runId: string, values: CompleteRunInput): unknown;
}

export class DrizzleSchedulerRepository implements ISchedulerRepository {
  constructor(private readonly db: Db = getDb()) {}

  findEnabledTasksDueBy(now: Date) {
    return this.db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now)))
      .all();
  }

  updateNextRun(taskId: string, nextRunAt: Date) {
    return this.db
      .update(scheduledTasks)
      .set({ nextRunAt, lastRunAt: new Date() })
      .where(eq(scheduledTasks.id, taskId))
      .run();
  }

  disable(taskId: string) {
    return this.db
      .update(scheduledTasks)
      .set({ enabled: false })
      .where(eq(scheduledTasks.id, taskId))
      .run();
  }

  createRun(values: CreateRunInput) {
    return this.db.insert(taskRuns).values(values).run();
  }

  completeRun(runId: string, values: CompleteRunInput) {
    return this.db.update(taskRuns).set(values).where(eq(taskRuns.id, runId)).run();
  }
}
