/**
 * Drizzle schema — Chat (sessions, messages, attachments)
 */

import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { agents } from './agents';
import { users } from './auth';
import { id, timestamp, metadata, shortText, longText } from './base';

export const chatSessions = sqliteTable(
  'chat_sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: shortText('title'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    metadata: metadata(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    lastActivity: timestamp('last_activity').notNull(),
  },
  (t) => ({
    userIdIdx: index('chat_sessions_user_id_idx').on(t.userId),
    lastActivityIdx: index('chat_sessions_last_activity_idx').on(t.lastActivity),
    archivedIdx: index('chat_sessions_archived_idx').on(t.archived),
  })
);

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: id(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
    content: longText('content').notNull(),
    attachments: text('attachments', { mode: 'json' }).$type<string[]>().notNull().default([]),
    toolCalls: text('tool_calls', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    toolResults: text('tool_results', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    metadata: metadata(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    sessionIdIdx: index('chat_messages_session_id_idx').on(t.sessionId),
  })
);

export const chatAttachments = sqliteTable(
  'chat_attachments',
  {
    id: id(),
    messageId: text('message_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    filename: shortText('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    path: text('path').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => ({
    messageIdIdx: index('chat_attachments_message_id_idx').on(t.messageId),
  })
);
