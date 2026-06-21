/**
 * Enrich schemas — Validator→Enricher pipeline for SPEC
 */

import { z } from 'zod';

import {
  LongStringSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const EnrichSessionStatusSchema = z.enum([
  'pending',
  'validator',
  'enricher',
  'completed',
  'cancelled',
]);

export type EnrichSessionStatus = z.infer<typeof EnrichSessionStatusSchema>;

/**
 * Enrich Session
 */
export const EnrichSessionSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  specPath: NonEmptyStringSchema,
  status: EnrichSessionStatusSchema,
  validatorAgentId: UuidSchema.optional(),
  enricherAgentId: UuidSchema.optional(),
  validatorMetrics: z
    .object({
      tokens: z.number().int().min(0).default(0),
      cost: z.number().min(0).default(0),
      durationMs: z.number().int().min(0).default(0),
    })
    .default({}),
  enricherMetrics: z
    .object({
      tokens: z.number().int().min(0).default(0),
      cost: z.number().min(0).default(0),
      durationMs: z.number().int().min(0).default(0),
    })
    .default({}),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  metadata: MetadataSchema,
});

export type EnrichSession = z.infer<typeof EnrichSessionSchema>;

/**
 * Enrich Message
 */
export const EnrichMessageSchema = z.object({
  id: UuidSchema,
  sessionId: UuidSchema,
  role: z.enum(['user', 'validator', 'enricher', 'system']),
  content: LongStringSchema,
  createdAt: TimestampSchema,
});

export type EnrichMessage = z.infer<typeof EnrichMessageSchema>;

export const CreateEnrichSessionInputSchema = EnrichSessionSchema.omit({
  id: true,
  userId: true,
  status: true,
  validatorMetrics: true,
  enricherMetrics: true,
  startedAt: true,
  completedAt: true,
  metadata: true,
});

export type CreateEnrichSessionInput = z.infer<typeof CreateEnrichSessionInputSchema>;
