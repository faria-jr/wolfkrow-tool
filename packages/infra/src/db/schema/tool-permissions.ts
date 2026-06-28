/**
 * Drizzle schema — Tool permission decisions (durable)
 *
 * When a user approves/denies a destructive tool via the chat permission flow,
 * the decision is persisted here so a worker restart does NOT re-ask for the
 * same tool. Keyed per (userId, agentId, tool) — one user's approvals never
 * leak to another. Upserted on every decision; latest decision wins.
 */

import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { id, timestamp } from './base';

/** Allowed values for the `decision` column. */
export const TOOL_PERMISSION_DECISIONS = ['allow', 'deny'] as const;
export type ToolPermissionDecision = (typeof TOOL_PERMISSION_DECISIONS)[number];

export const toolPermissions = sqliteTable(
  'tool_permissions',
  {
    id: id(),
    userId: text('user_id').notNull(),
    agentId: text('agent_id').notNull(),
    tool: text('tool').notNull(),
    /** Latest user decision: 'allow' | 'deny'. */
    decision: text('decision', { enum: TOOL_PERMISSION_DECISIONS }).notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => ({
    // One decision per (user, agent, tool) — upsert target.
    userAgentToolIdx: uniqueIndex('tool_permissions_user_agent_tool_idx').on(
      t.userId,
      t.agentId,
      t.tool
    ),
    userIdx: index('tool_permissions_user_id_idx').on(t.userId),
  })
);
