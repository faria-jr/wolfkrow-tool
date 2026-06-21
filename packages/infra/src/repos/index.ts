/**
 * Repository helpers for scheduled tasks and task runs
 */

import { and, eq, lte } from 'drizzle-orm';

export type { Entity } from './base';
export { DrizzleRepo, InMemoryRepo } from './base';
export { DrizzleUserRepo } from './user-repo';
export { DrizzleAgentRepo } from './agent-repo';

import { getDb } from '../db/client';
import { scheduledTasks, taskRuns } from '../db/schema/scheduler';

export function getScheduledTasksRepository() {
  const db = getDb();

  return {
    findEnabledTasksDueBy(now: Date) {
      return db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.enabled, true),
            lte(scheduledTasks.nextRunAt, now)
          )
        )
        .all();
    },

    updateNextRun(taskId: string, nextRunAt: Date) {
      return db
        .update(scheduledTasks)
        .set({ nextRunAt, lastRunAt: new Date() })
        .where(eq(scheduledTasks.id, taskId))
        .run();
    },

    disable(taskId: string) {
      return db
        .update(scheduledTasks)
        .set({ enabled: false })
        .where(eq(scheduledTasks.id, taskId))
        .run();
    },

    createRun(values: {
      id: string;
      taskId: string;
      status: 'pending' | 'running' | 'awaiting_review' | 'validated' | 'rejected';
      startedAt: Date;
      output?: Record<string, unknown>;
      error?: string;
    }) {
      return db.insert(taskRuns).values(values).run();
    },

    completeRun(
      runId: string,
      values: {
        status: 'awaiting_review' | 'validated' | 'rejected';
        completedAt: Date;
        output?: Record<string, unknown>;
        error?: string;
      }
    ) {
      return db.update(taskRuns).set(values).where(eq(taskRuns.id, runId)).run();
    },
  };
}

export type ScheduledTasksRepository = ReturnType<typeof getScheduledTasksRepository>;
