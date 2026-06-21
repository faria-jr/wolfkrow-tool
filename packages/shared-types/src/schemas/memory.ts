/**
 * Memory schemas — semantic memory, daily summaries, compaction
 */

import { z } from 'zod';

import {
  LongStringSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const CompactionTriggerSchema = z.enum(['manual', 'token_threshold', 'time_based', 'idle']);

export type CompactionTrigger = z.infer<typeof CompactionTriggerSchema>;

/**
 * Semantic Memory
 */
export const SemanticMemorySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  content: NonEmptyStringSchema,
  embedding: z.array(z.number()).optional(),
  source: z.enum(['conversation', 'compaction', 'user', 'agent']),
  importance: z.number().min(0).max(1).default(0.5),
  accessCount: z.number().int().min(0).default(0),
  lastAccessedAt: TimestampSchema.optional(),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});

export type SemanticMemory = z.infer<typeof SemanticMemorySchema>;

export const CreateSemanticMemoryInputSchema = SemanticMemorySchema.omit({
  id: true,
  userId: true,
  embedding: true,
  accessCount: true,
  lastAccessedAt: true,
  createdAt: true,
});

export type CreateSemanticMemoryInput = z.infer<typeof CreateSemanticMemoryInputSchema>;

/**
 * Daily Summary
 */
export const DailySummarySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: LongStringSchema,
  sessionCount: z.number().int().min(0).default(0),
  messageCount: z.number().int().min(0).default(0),
  tokensUsed: z.number().int().min(0).default(0),
  cost: z.number().min(0).default(0),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});

export type DailySummary = z.infer<typeof DailySummarySchema>;

/**
 * Compaction Log Entry
 */
export const CompactionLogEntrySchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  sessionId: UuidSchema.optional(),
  trigger: CompactionTriggerSchema,
  beforeTokens: z.number().int().min(0),
  afterTokens: z.number().int().min(0),
  tokensSaved: z.number().int().min(0),
  summary: z.string().max(10_000).optional(),
  createdAt: TimestampSchema,
});

export type CompactionLogEntry = z.infer<typeof CompactionLogEntrySchema>;

/**
 * Compact session input
 */
export const CompactSessionInputSchema = z.object({
  sessionId: UuidSchema,
  trigger: CompactionTriggerSchema.default('manual'),
  preserveLastMessages: z.number().int().min(0).default(10),
});

export type CompactSessionInput = z.infer<typeof CompactSessionInputSchema>;
