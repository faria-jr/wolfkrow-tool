import { randomUUID } from 'node:crypto';

import type {
  TaskItem,
  TaskItemCreateInput,
  TaskItemFilter,
  TaskItemRepo,
  TaskItemUpdateInput,
} from '@wolfkrow/domain';
import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { tasks } from '../db/schema/tasks';

/**
 * Task-item repository via Drizzle (SQLite). Implementa o port `TaskItemRepo`
 * do domínio .
 *
 * Invariante: `completedAt` é derivado de `status` no `update` — `done` marca
 * now, qualquer outro status limpa. Single source of truth no repo.
 */
export class DrizzleTaskRepo implements TaskItemRepo {
  constructor(private readonly db = getDb()) {}

  findMany(filter: TaskItemFilter): TaskItem[] {
    const conds = [eq(tasks.userId, filter.userId)];
    if (filter.status) conds.push(eq(tasks.status, filter.status));
    if (filter.category) conds.push(eq(tasks.category, filter.category));
    return this.db
      .select()
      .from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt))
      .all()
      .map(this.toRecord);
  }

  create(input: TaskItemCreateInput): TaskItem {
    const now = new Date();
    const record = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? ('todo' as never),
      category: input.category ?? ('personal' as never),
      priority: input.priority ?? ('medium' as never),
      dueDate: input.dueDate ?? null,
      completedAt: input.status === 'done' ? now : null,
      tags: input.tags ?? [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(tasks).values(record).run();
    return this.toRecord({ ...record });
  }

  update(id: string, input: TaskItemUpdateInput): TaskItem | null {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) set['title'] = input.title;
    if (input.description !== undefined) set['description'] = input.description;
    if (input.priority !== undefined) set['priority'] = input.priority;
    if (input.category !== undefined) set['category'] = input.category;
    if (input.dueDate !== undefined) set['dueDate'] = input.dueDate;
    if (input.tags !== undefined) set['tags'] = input.tags;
    if (input.status !== undefined) {
      set['status'] = input.status;
      set['completedAt'] = input.status === 'done' ? new Date() : null;
    }
    this.db
      .update(tasks)
      .set(set as never)
      .where(eq(tasks.id, id))
      .run();
    const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get();
    return row ? this.toRecord(row) : null;
  }

  delete(id: string): void {
    this.db.delete(tasks).where(eq(tasks.id, id)).run();
  }

  private toRecord = (r: typeof tasks.$inferSelect): TaskItem => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    category: r.category,
    priority: r.priority,
    dueDate: r.dueDate ?? null,
    completedAt: r.completedAt ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });
}
