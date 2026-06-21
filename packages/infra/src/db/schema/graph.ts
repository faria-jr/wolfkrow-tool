/**
 * Drizzle schema — Knowledge Graph (nodes + edges)
 */

import { index, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp } from './base';

export const graphNodes = sqliteTable(
  'graph_nodes',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    type: text('type', { enum: ['document', 'entity', 'concept', 'memory'] }).notNull(),
    sourceId: text('source_id'),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({ userIdx: index('graph_nodes_user_idx').on(t.userId) }),
);

export const graphEdges = sqliteTable(
  'graph_edges',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sourceNodeId: text('source_node_id').notNull(),
    targetNodeId: text('target_node_id').notNull(),
    relation: text('relation').notNull().default('related'),
    weight: real('weight').notNull().default(1.0),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    userIdx: index('graph_edges_user_idx').on(t.userId),
    srcIdx: index('graph_edges_src_idx').on(t.sourceNodeId),
  }),
);
