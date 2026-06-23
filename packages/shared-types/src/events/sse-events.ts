/**
 * SSE Event schemas — Server-Sent Events for streaming
 */

import { z } from 'zod';

import { NonEmptyStringSchema, UuidSchema } from '../schemas/common';

const BaseEventSchema = z.object({
  id: z.string().optional(),
  timestamp: z.coerce.date().default(() => new Date()),
});

/**
 * Chat streaming chunks
 */
export const ChatStreamChunkSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({
    type: z.literal('start'),
    sessionId: UuidSchema,
    messageId: UuidSchema,
    agent: z.object({
      id: UuidSchema,
      name: z.string(),
      model: z.string(),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('text'),
    content: z.string(),
  }),
  BaseEventSchema.extend({
    type: z.literal('tool_call'),
    id: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    input: z.record(z.unknown()),
  }),
  BaseEventSchema.extend({
    type: z.literal('tool_result'),
    id: NonEmptyStringSchema,
    output: z.unknown(),
    isError: z.boolean().default(false),
  }),
  BaseEventSchema.extend({
    type: z.literal('tool_permission'),
    id: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    input: z.record(z.unknown()),
    prompt: z.string(),
  }),
  BaseEventSchema.extend({
    type: z.literal('usage'),
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0).default(0),
    cacheWriteTokens: z.number().int().min(0).default(0),
    cost: z.number().min(0),
  }),
  BaseEventSchema.extend({
    type: z.literal('done'),
    sessionId: UuidSchema,
    messageId: UuidSchema,
    totalUsage: z.object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      cost: z.number().min(0),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
  }),
]);

export type ChatStreamChunk = z.infer<typeof ChatStreamChunkSchema>;

/**
 * Pipeline streaming chunks
 */
export const PipelineStreamChunkSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({
    type: z.literal('message'),
    phaseId: UuidSchema,
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  }),
  BaseEventSchema.extend({
    type: z.literal('phase_changed'),
    phaseId: UuidSchema,
    status: z.enum(['pending', 'in_progress', 'awaiting_user', 'completed', 'failed', 'skipped']),
  }),
  BaseEventSchema.extend({
    type: z.literal('done'),
    projectId: UuidSchema,
  }),
  BaseEventSchema.extend({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type PipelineStreamChunk = z.infer<typeof PipelineStreamChunkSchema>;

/**
 * Harness streaming chunks
 */
export const HarnessStreamChunkSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({
    type: z.literal('message'),
    sprintId: UuidSchema,
    agent: z.enum(['planner', 'coder', 'evaluator']),
    content: z.string(),
  }),
  BaseEventSchema.extend({
    type: z.literal('round_started'),
    sprintId: UuidSchema,
    featureIndex: z.number().int().min(0),
    round: z.number().int().positive(),
  }),
  BaseEventSchema.extend({
    type: z.literal('round_passed'),
    roundId: UuidSchema,
  }),
  BaseEventSchema.extend({
    type: z.literal('round_failed'),
    roundId: UuidSchema,
    feedback: z.string(),
  }),
  BaseEventSchema.extend({
    type: z.literal('sprint_completed'),
    sprintId: UuidSchema,
  }),
  BaseEventSchema.extend({
    type: z.literal('done'),
    projectId: UuidSchema,
  }),
]);

export type HarnessStreamChunk = z.infer<typeof HarnessStreamChunkSchema>;

/**
 * Knowledge ingest progress
 */
export const IngestProgressSchema = z.discriminatedUnion('stage', [
  BaseEventSchema.extend({
    stage: z.literal('parsing'),
    progress: z.number().min(0).max(1),
  }),
  BaseEventSchema.extend({
    stage: z.literal('chunking'),
    progress: z.number().min(0).max(1),
    chunksCount: z.number().int().min(0).optional(),
  }),
  BaseEventSchema.extend({
    stage: z.literal('embedding'),
    progress: z.number().min(0).max(1),
    chunksProcessed: z.number().int().min(0),
    chunksTotal: z.number().int().min(0),
  }),
  BaseEventSchema.extend({
    stage: z.literal('saving'),
    progress: z.number().min(0).max(1),
  }),
  BaseEventSchema.extend({
    stage: z.literal('done'),
    progress: z.literal(1),
    documentId: UuidSchema,
    chunkCount: z.number().int().min(0),
  }),
]);

export type IngestProgress = z.infer<typeof IngestProgressSchema>;
