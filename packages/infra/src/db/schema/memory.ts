/**
 * Drizzle schema — Memory (semantic memory, daily summaries, compaction log)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata } from './base';

export const semanticMemories = sqliteTable(
  'semantic_memories',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: text('embedding', { mode: 'json' }).$type<number[]>(),
    source: text('source', {
      enum: ['conversation', 'compaction', 'user', 'agent'],
    }).notNull(),
    importance: integer('importance').notNull().default(50),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessedAt: timestamp('last_accessed_at'),
    metadata: metadata(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('semantic_memories_user_id_idx').on(t.userId),
    importanceIdx: index('semantic_memories_importance_idx').on(t.importance),
  })
);

export const dailySummaries = sqliteTable(
  'daily_summaries',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    content: text('content').notNull(),
    sessionCount: integer('session_count').notNull().default(0),
    messageCount: integer('message_count').notNull().default(0),
    tokensUsed: integer('tokens_used').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    metadata: metadata(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    userIdDateIdx: index('daily_summaries_user_id_date_idx').on(t.userId, t.date),
  })
);

export const compactionLog = sqliteTable(
  'compaction_log',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    trigger: text('trigger', {
      enum: ['manual', 'token_threshold', 'time_based', 'idle'],
    }).notNull(),
    beforeTokens: integer('before_tokens').notNull(),
    afterTokens: integer('after_tokens').notNull(),
    tokensSaved: integer('tokens_saved').notNull(),
    summary: text('summary'),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    userIdIdx: index('compaction_log_user_id_idx').on(t.userId),
    sessionIdIdx: index('compaction_log_session_id_idx').on(t.sessionId),
  })
);
