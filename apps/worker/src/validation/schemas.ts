/**
 * H.2 — Runtime Zod schemas for all worker route handlers.
 *
 * Single source of truth for input validation. Fastify uses these via
 * fastify-type-provider-zod (validatorCompiler + serializerCompiler).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const uuidParam = z.object({ id: z.string().uuid() });

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Vault — SPEC-011
// ---------------------------------------------------------------------------

export const vaultStoreBody = z.object({
  key: z.string().min(1).max(128).regex(/^[\w.\-:/]+$/),
  value: z.string().min(1),
  description: z.string().max(512).optional(),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const vaultUpdateBody = z.object({
  value: z.string().min(1).optional(),
  description: z.string().max(512).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

// ---------------------------------------------------------------------------
// Tasks — S.4
// ---------------------------------------------------------------------------

export const taskBody = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).default('todo'),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).default('personal'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const taskQuery = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  category: z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']).optional(),
});

// ---------------------------------------------------------------------------
// Rules — S.3
// ---------------------------------------------------------------------------

export const ruleBody = z.object({
  title: z.string().min(1).max(128),
  body: z.string().min(1).max(8192),
  kind: z.enum(['behavior', 'soul', 'user', 'custom']),
  isEnabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(999).default(0),
});

// ---------------------------------------------------------------------------
// Knowledge — N.4
// ---------------------------------------------------------------------------

export const knowledgeSearchQuery = z.object({
  q: z.string().min(1).max(512),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  model: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Graph ingest — S.5
// ---------------------------------------------------------------------------

export const graphIngestBody = z.object({
  text: z.string().min(1).max(500_000),
  sourceId: z.string().max(256).optional(),
  sourceLabel: z.string().max(256).optional(),
});

export const neighborhoodQuery = z.object({
  depth: z.coerce.number().int().min(1).max(3).default(1),
});

// ---------------------------------------------------------------------------
// Usage — S.2
// ---------------------------------------------------------------------------

export const usageQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  model: z.string().optional(),
  source: z.string().optional(),
  agentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Permissions — S.3
// ---------------------------------------------------------------------------

export const resolvePermissionBody = z.object({
  agentId: z.string().min(1),
  tool: z.string().min(1).max(128),
  input: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// Telegram — B.5
// ---------------------------------------------------------------------------

export const telegramStartBody = z.object({ token: z.string().min(1) });
export const telegramPairBody  = z.object({ userId: z.string().min(1) });

// ---------------------------------------------------------------------------
// PTY — B.5
// ---------------------------------------------------------------------------

export const ptyCreateBody = z.object({
  id: z.string().min(1).max(64).optional(),
  cols: z.coerce.number().int().min(10).max(500).default(80),
  rows: z.coerce.number().int().min(5).max(200).default(24),
  cwd: z.string().max(1024).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Voice — B.4
// ---------------------------------------------------------------------------

export const voiceSynthesizeBody = z.object({
  text: z.string().min(1).max(4096),
  voice: z.string().max(128).optional(),
  model: z.string().max(128).optional(),
  provider: z.enum(['elevenlabs', 'cartesia']).default('elevenlabs'),
});

// ---------------------------------------------------------------------------
// Scheduler — N.6
// ---------------------------------------------------------------------------

export const schedulerCreateBody = z.object({
  name: z.string().min(1).max(128),
  cron: z.string().min(1).max(128),
  agentId: z.string().uuid(),
  prompt: z.string().min(1).max(8192),
  isActive: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// MCP — N.3
// ---------------------------------------------------------------------------

export const mcpCreateBody = z.object({
  name: z.string().min(1).max(128),
  command: z.string().min(1).max(1024),
  args: z.array(z.string()).max(50).default([]),
  env: z.record(z.string(), z.string()).optional(),
  visibility: z.enum(['always', 'on-demand']).default('always'),
});

// ---------------------------------------------------------------------------
// Agents — N.1
// ---------------------------------------------------------------------------

export const agentBody = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  model: z.string().min(1).max(128),
  effort: z.enum(['low', 'medium', 'high', 'max']),
  thinking: z.boolean().default(false),
  thinkingBudget: z.coerce.number().int().min(100).max(100_000).optional(),
  maxTurns: z.coerce.number().int().min(1).max(200).default(80),
  allowedTools: z.array(z.string()).max(100).default([]),
  mcpServers: z.array(z.string()).max(50).default([]),
  skills: z.array(z.string()).max(100).default([]),
  runtime: z.enum(['cloud', 'local', 'codex', 'external']),
  squad: z.enum(['harness', 'workflow', 'enrich', 'custom']).optional(),
  systemPrompt: z.string().max(65536).optional(),
});

// ---------------------------------------------------------------------------
// Logs — S.3
// ---------------------------------------------------------------------------

export const logsQuery = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  module: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
