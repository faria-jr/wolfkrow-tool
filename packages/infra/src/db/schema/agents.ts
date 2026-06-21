/**
 * Drizzle schema — Agents (AI agent configs)
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { id, timestamp, metadata, shortText, longText } from './base';

export const agents = sqliteTable('agents', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: shortText('name').notNull(),
  description: text('description'),
  model: text('model').notNull(),
  effort: text('effort', { enum: ['low', 'medium', 'high', 'max'] }).notNull(),
  thinking: integer('thinking', { mode: 'boolean' }).notNull().default(false),
  thinkingBudget: integer('thinking_budget'),
  maxTurns: integer('max_turns').notNull().default(80),
  allowedTools: text('allowed_tools', { mode: 'json' }).$type<string[]>().notNull().default([]),
  mcpServers: text('mcp_servers', { mode: 'json' }).$type<string[]>().notNull().default([]),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  skills: text('skills', { mode: 'json' }).$type<string[]>().notNull().default([]),
  runtime: text('runtime', { enum: ['cloud', 'local', 'codex', 'external'] }).notNull(),
  squad: text('squad', { enum: ['harness', 'workflow', 'enrich', 'custom'] }),
  systemPrompt: longText('system_prompt'),
  metadata: metadata(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const agentSyncHistory = sqliteTable('agent_sync_history', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  syncedAgentIds: text('synced_agent_ids', { mode: 'json' }).$type<string[]>().notNull(),
  sourceOrchestrator: text('source_orchestrator').notNull(),
  diff: metadata(),
  createdAt: timestamp('created_at').notNull(),
});
