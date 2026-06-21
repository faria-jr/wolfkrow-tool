/**
 * Drizzle schema — MCP servers (Model Context Protocol)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText } from './base';

export const mcpServers = sqliteTable('mcp_servers', {
  id: id(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull().unique(),
  description: text('description'),
  command: text('command').notNull(),
  args: text('args', { mode: 'json' }).$type<string[]>().notNull().default([]),
  env: text('env', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
  visibility: text('visibility', { enum: ['always', 'on-demand', 'background'] })
    .notNull()
    .default('always'),
  healthCheck: text('health_check'),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const mcpToolRegistry = sqliteTable('mcp_tool_registry', {
  id: id(),
  mcpServerId: text('mcp_server_id')
    .notNull()
    .references(() => mcpServers.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description'),
  inputSchema: text('input_schema', { mode: 'json' }).$type<Record<string, unknown>>(),
  lastSynced: timestamp('last_synced').notNull(),
});
