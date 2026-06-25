/**
 * Tool-permission decision repository (Drizzle/SQLite).
 *
 * Persists durable allow/deny decisions keyed by (userId, agentId, tool).
 * The permission store caches these in-memory and reloads from here on
 * worker startup so a restart does NOT re-ask already-approved tools.
 */

import { randomUUID } from 'crypto';

import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { toolPermissions } from '../db/schema';
import type { ToolPermissionDecision } from '../db/schema';

export type { ToolPermissionDecision };

export interface ToolPermissionRow {
  userId: string;
  agentId: string;
  tool: string;
  decision: ToolPermissionDecision;
  updatedAt: Date;
}

type Db = ReturnType<typeof getDb>;

export class DrizzleToolPermissionRepo {
  constructor(private readonly db: Db = getDb()) {}

  /**
   * Upsert a decision. Key = (userId, agentId, tool). Changing allow→deny
   * updates the existing row (latest decision wins); repeating the same
   * decision is a no-op row update.
   */
  upsert(input: {
    userId: string;
    agentId: string;
    tool: string;
    decision: ToolPermissionDecision;
  }): void {
    const now = new Date();
    this.db
      .insert(toolPermissions)
      .values({
        id: randomUUID(),
        userId: input.userId,
        agentId: input.agentId,
        tool: input.tool,
        decision: input.decision,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          toolPermissions.userId,
          toolPermissions.agentId,
          toolPermissions.tool,
        ],
        set: {
          decision: input.decision,
          updatedAt: now,
        },
      })
      .run();
  }

  /** Load the decision for a (userId, agentId, tool) triple, or null. */
  findDecision(
    userId: string,
    agentId: string,
    tool: string,
  ): ToolPermissionDecision | null {
    const rows = this.db
      .select({ decision: toolPermissions.decision })
      .from(toolPermissions)
      .where(
        and(
          eq(toolPermissions.userId, userId),
          eq(toolPermissions.agentId, agentId),
          eq(toolPermissions.tool, tool),
        ),
      )
      .all();
    const row = rows[0];
    return row ? row.decision : null;
  }

  /**
   * Load ALL decisions into a plain map for fast in-memory lookup.
   * Used at worker startup to warm the cache. Key = `${userId}|${agentId}|${tool}`.
   */
  loadAll(): Map<string, ToolPermissionDecision> {
    const rows = this.db
      .select({
        userId: toolPermissions.userId,
        agentId: toolPermissions.agentId,
        tool: toolPermissions.tool,
        decision: toolPermissions.decision,
      })
      .from(toolPermissions)
      .all();
    const out = new Map<string, ToolPermissionDecision>();
    for (const r of rows) {
      out.set(decisionKey(r.userId, r.agentId, r.tool), r.decision);
    }
    return out;
  }
}

/** Stable cache key for a (userId, agentId, tool) triple. */
export function decisionKey(userId: string, agentId: string, tool: string): string {
  // Delimiters chosen so values containing '|' cannot collide: length-prefixed.
  return `${userId.length}|${userId}|${agentId.length}|${agentId}|${tool}`;
}
