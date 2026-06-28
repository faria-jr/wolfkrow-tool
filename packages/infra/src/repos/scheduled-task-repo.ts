import type { ScheduledTaskRepo } from '@wolfkrow/domain';
import { ScheduledTask } from '@wolfkrow/domain';
import { and, eq, lte } from 'drizzle-orm';

import { getDb } from '../db/client';
import { scheduledTasks } from '../db/schema/scheduler';

type DbRow = typeof scheduledTasks.$inferSelect;

function toEntity(row: DbRow): ScheduledTask {
  return ScheduledTask.fromProps({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    prompt: row.prompt,
    agentId: row.agentId ?? undefined,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt ?? undefined,
    nextRunAt: row.nextRunAt ?? undefined,
    config: (row.config ?? {}) as Record<string, unknown>,
    tags: row.tags,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  });
}

export class DrizzleScheduledTaskRepo implements ScheduledTaskRepo {
  constructor(private readonly db = getDb()) {}

  async findById(id: string): Promise<ScheduledTask | null> {
    const rows = this.db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).all();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<ScheduledTask[]> {
    return this.db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.userId, userId))
      .all()
      .map(toEntity);
  }

  async findEnabledDueBy(now: Date): Promise<ScheduledTask[]> {
    return this.db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now)))
      .all()
      .map(toEntity);
  }

  async save(task: ScheduledTask): Promise<ScheduledTask> {
    const p = task.toProps();
    this.db
      .insert(scheduledTasks)
      .values({
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description ?? null,
        cronExpression: p.cronExpression,
        timezone: p.timezone,
        prompt: p.prompt,
        agentId: p.agentId ?? null,
        enabled: p.enabled,
        lastRunAt: p.lastRunAt ?? null,
        nextRunAt: p.nextRunAt ?? null,
        config: p.config,
        tags: p.tags,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
      .onConflictDoUpdate({
        target: scheduledTasks.id,
        set: {
          name: p.name,
          description: p.description ?? null,
          cronExpression: p.cronExpression,
          prompt: p.prompt,
          agentId: p.agentId ?? null,
          enabled: p.enabled,
          lastRunAt: p.lastRunAt ?? null,
          nextRunAt: p.nextRunAt ?? null,
          config: p.config,
          tags: p.tags,
          updatedAt: p.updatedAt,
        },
      })
      .run();
    return task;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(scheduledTasks).where(eq(scheduledTasks.id, id)).run();
  }
}
