/**
 * Usage schemas — token usage tracking and cost analytics
 */

import { z } from 'zod';

import { MetadataSchema, NonEmptyStringSchema, TimestampSchema, UuidSchema } from './common';

export const TokenUsageSourceSchema = z.enum([
  'chat',
  'agent',
  'harness',
  'pipeline',
  'enrich',
  'memory',
  'voice',
  'embedding',
]);

export type TokenUsageSource = z.infer<typeof TokenUsageSourceSchema>;

/**
 * Token Usage Entry
 */
export const TokenUsageSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  source: TokenUsageSourceSchema,
  model: NonEmptyStringSchema,
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0).default(0),
  cacheWriteTokens: z.number().int().min(0).default(0),
  cost: z.number().min(0),
  sessionId: UuidSchema.optional(),
  agentId: UuidSchema.optional(),
  metadata: MetadataSchema,
  timestamp: TimestampSchema,
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Usage query/aggregation
 */
export const UsageQuerySchema = z.object({
  from: TimestampSchema.optional(),
  to: TimestampSchema.optional(),
  sources: z.array(TokenUsageSourceSchema).optional(),
  models: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'source', 'model']).default('day'),
});

export type UsageQuery = z.infer<typeof UsageQuerySchema>;

export const UsageStatsSchema = z.object({
  totalTokens: z.number().int().min(0),
  totalCost: z.number().min(0),
  totalRequests: z.number().int().min(0),
  bySource: z.record(TokenUsageSourceSchema, z.number().min(0)),
  byModel: z.record(z.string(), z.number().min(0)),
  byDay: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tokens: z.number().int().min(0),
      cost: z.number().min(0),
      requests: z.number().int().min(0),
    })
  ),
});

export type UsageStats = z.infer<typeof UsageStatsSchema>;
