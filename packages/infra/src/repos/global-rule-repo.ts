
import { GlobalRule } from '@wolfkrow/domain';
import type { GlobalRuleRepo, RuleKind } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { globalRules } from '../db/schema';

export class DrizzleGlobalRuleRepo implements GlobalRuleRepo {
  constructor(private readonly db = getDb()) {}

  async findAll(userId: string): Promise<GlobalRule[]> {
    const rows = this.db
      .select()
      .from(globalRules)
      .where(eq(globalRules.userId, userId))
      .all();

    return rows.map((r) =>
      GlobalRule.fromProps({
        id: r.id,
        userId: r.userId,
        kind: r.kind as RuleKind,
        title: r.title,
        body: r.body,
        enabled: r.enabled,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async findById(id: string): Promise<GlobalRule | null> {
    const row = this.db.select().from(globalRules).where(eq(globalRules.id, id)).get();
    if (!row) return null;
    return GlobalRule.fromProps({
      id: row.id,
      userId: row.userId,
      kind: row.kind as RuleKind,
      title: row.title,
      body: row.body,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(rule: GlobalRule): Promise<GlobalRule> {
    const p = rule.toProps();
    this.db
      .insert(globalRules)
      .values({
        id: p.id,
        userId: p.userId,
        kind: p.kind,
        title: p.title,
        body: p.body,
        enabled: p.enabled,
        sortOrder: p.sortOrder,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
      .onConflictDoUpdate({
        target: globalRules.id,
        set: {
          kind: p.kind,
          title: p.title,
          body: p.body,
          enabled: p.enabled,
          sortOrder: p.sortOrder,
          updatedAt: p.updatedAt,
        },
      })
      .run();
    return rule;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(globalRules).where(eq(globalRules.id, id)).run();
  }
}
