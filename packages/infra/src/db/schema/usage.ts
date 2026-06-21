/**
 * Drizzle schema — Usage (token tracking and cost analytics)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const tokenUsage = sqliteTable(
  'token_usage',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', {
      enum: ['chat', 'agent', 'harness', 'pipeline', 'enrich', 'memory', 'voice', 'embedding'],
    }).notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    cost: integer('cost').notNull(),
    sessionId: text('session_id'),
    agentId: text('agent_id'),
    metadata: metadata(),
    timestamp: timestamp('timestamp').notNull(),
  },
  (t) => ({
    userIdIdx: index('token_usage_user_id_idx').on(t.userId),
    timestampIdx: index('token_usage_timestamp_idx').on(t.timestamp),
    sourceIdx: index('token_usage_source_idx').on(t.source),
  }),
);
