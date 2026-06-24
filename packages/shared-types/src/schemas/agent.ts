/**
 * Agent schema — AI agent configurations (sub-agents, seed agents, orchestrator)
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';
import { EffortSchema, RuntimeSchema, SquadSchema } from './common';

/**
 * Full Agent entity
 */
export const AgentSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  model: NonEmptyStringSchema,
  effort: EffortSchema,
  thinking: z.boolean().default(false),
  thinkingBudget: z.number().int().positive().optional(),
  maxTurns: z.number().int().positive().default(80),
  allowedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  skills: z.array(z.string()).default([]),
  runtime: RuntimeSchema,
  provider: z.string().max(64).optional(),
  squad: SquadSchema.optional(),
  systemPrompt: z.string().max(100_000).optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * Create agent input (omits server-managed fields)
 */
export const CreateAgentInputSchema = AgentSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateAgentInput = z.infer<typeof CreateAgentInputSchema>;

/**
 * Update agent input (partial)
 */
export const UpdateAgentInputSchema = CreateAgentInputSchema.partial();

export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>;

/**
 * Agent YAML format (used in .wolfkrow/agents/*.yaml files)
 */
export const AgentYamlSchema = AgentSchema.extend({
  tags: z.array(z.string()).default([]),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
      })
    )
    .default([]),
  metadata: z
    .object({
      author: z.string().optional(),
      version: z.string().default('1.0.0'),
    })
    .default({}),
});

export type AgentYaml = z.infer<typeof AgentYamlSchema>;

/**
 * Agent sync result (for bulk operations)
 */
export const AgentSyncResultSchema = z.object({
  syncedAgentIds: z.array(UuidSchema),
  sourceOrchestrator: NonEmptyStringSchema,
  diff: MetadataSchema,
  createdAt: TimestampSchema,
});

export type AgentSyncResult = z.infer<typeof AgentSyncResultSchema>;

/**
 * Create-agent request body (web POST /api/agents).
 *
 * Like {@link CreateAgentInputSchema} but with the request-level defaults the
 * web handler has always applied (`model`, `effort`, `runtime`).
 */
export const CreateAgentRequestBodySchema = z.object({
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  model: NonEmptyStringSchema.default('claude-sonnet-4-6'),
  effort: EffortSchema.default('medium'),
  thinking: z.boolean().default(false),
  thinkingBudget: z.number().int().positive().optional(),
  maxTurns: z.number().int().positive().default(80),
  allowedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  skills: z.array(z.string()).default([]),
  runtime: RuntimeSchema.default('cloud'),
  provider: z.string().max(64).optional(),
  squad: SquadSchema.optional(),
  systemPrompt: z.string().max(100_000).optional(),
});

export type CreateAgentRequestBody = z.infer<typeof CreateAgentRequestBodySchema>;

/**
 * Duplicate-agent request body.
 */
export const DuplicateAgentRequestBodySchema = z.object({
  newName: ShortStringSchema,
});

export type DuplicateAgentRequestBody = z.infer<typeof DuplicateAgentRequestBodySchema>;

/**
 * Agent sync request body (web POST /api/agents/sync).
 */
export const AgentSyncRequestBodySchema = z.object({
  targetRuntime: z.enum(['cloud', 'local', 'codex', 'external']),
  targetModel: z.string().max(128).optional(),
});

export type AgentSyncRequestBody = z.infer<typeof AgentSyncRequestBodySchema>;
