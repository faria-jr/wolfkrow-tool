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
 * Where the inference actually ran. Independent of `source` (which records
 * the Wolfkrow feature that initiated the call) — a chat or harness call
 * can hit either a hosted provider or a self-hosted Ollama-style endpoint.
 * `cloud`  = hosted API billed by tokens (Anthropic, OpenAI, claude-compat,
 * OpenRouter, Codex cloud).
 * `local`  = self-hosted runtime (Ollama, local llama.cpp, on-prem vLLM)
 * where token counts still feed cost tracking but the cost is often zero.
 */
export const RuntimeOriginSchema = z.enum(['cloud', 'local']);

export type RuntimeOrigin = z.infer<typeof RuntimeOriginSchema>;

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
  runtime: RuntimeOriginSchema,
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

/**
 * Per-dimension token/cost breakdown entry.
 *
 * Aggregated across records sharing a model, source, or calendar day.
 */
const UsageBreakdownEntrySchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUSD: z.number().min(0),
});

/**
 * Canonical `/usage/summary` response contract.
 *
 * This is the SINGLE source of truth for the shape of `GET /usage/summary`.
 * The use-case produces exactly this shape, the worker parses it at the
 * boundary before `reply.send`, and the frontend imports the `UsageSummary`
 * type to render the charts. Field names follow the underlying data model
 * (`TokenUsageSchema` has separate `inputTokens`/`outputTokens`/`cost`).
 */
export const UsageSummarySchema = z.object({
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalCostUSD: z.number().min(0),
  byModel: z.record(z.string(), UsageBreakdownEntrySchema),
  bySource: z.record(z.string(), UsageBreakdownEntrySchema),
  byRuntime: z.record(RuntimeOriginSchema, UsageBreakdownEntrySchema),
  byDay: z.array(
    z.object({
      day: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((s) => {
          const parts = s.split('-').map(Number);
          const y = parts[0]!;
          const m = parts[1]!;
          const d = parts[2]!;
          const date = new Date(Date.UTC(y, m - 1, d));
          // JS Date rolls overflow (e.g. Feb 30 → Mar 1) instead of producing
          // NaN, so verify the constructed date matches the input components.
          return (
            date.getUTCFullYear() === y &&
            date.getUTCMonth() === m - 1 &&
            date.getUTCDate() === d
          );
        }, 'invalid calendar date'),
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      costUSD: z.number().min(0),
    }),
  ),
});

export type UsageSummary = z.infer<typeof UsageSummarySchema>;
