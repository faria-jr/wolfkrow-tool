/**
 * Domain event schemas — internal event bus
 */

import { z } from 'zod';

import { UuidSchema } from '../schemas/common';

const BaseEventSchema = z.object({
  eventId: UuidSchema,
  occurredAt: z.coerce.date(),
  userId: UuidSchema.optional(),
  correlationId: z.string().optional(),
});

export const MessageSentEventSchema = BaseEventSchema.extend({
  type: z.literal('message.sent'),
  sessionId: UuidSchema,
  messageId: UuidSchema,
  agentId: UuidSchema,
  content: z.string(),
});

export const AgentCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('agent.created'),
  agentId: UuidSchema,
  name: z.string(),
});

export const DocumentIngestCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('document.ingest.completed'),
  documentId: UuidSchema,
  chunkCount: z.number().int().min(0),
});

export const PipelinePhaseChangedEventSchema = BaseEventSchema.extend({
  type: z.literal('pipeline.phase.changed'),
  projectId: UuidSchema,
  phaseId: UuidSchema,
  status: z.enum(['pending', 'in_progress', 'awaiting_user', 'completed', 'failed', 'skipped']),
});

export const HarnessRoundCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('harness.round.completed'),
  roundId: UuidSchema,
  sprintId: UuidSchema,
  passed: z.boolean(),
});

export const TaskRunCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('task.run.completed'),
  runId: UuidSchema,
  taskId: UuidSchema,
  passed: z.boolean(),
});

export const SecretAccessedEventSchema = BaseEventSchema.extend({
  type: z.literal('secret.accessed'),
  secretKey: z.string(),
});

export const CompactionTriggeredEventSchema = BaseEventSchema.extend({
  type: z.literal('memory.compaction.triggered'),
  sessionId: UuidSchema,
  trigger: z.enum(['manual', 'token_threshold', 'time_based', 'idle']),
});

export const DomainEventSchema = z.discriminatedUnion('type', [
  MessageSentEventSchema,
  AgentCreatedEventSchema,
  DocumentIngestCompletedEventSchema,
  PipelinePhaseChangedEventSchema,
  HarnessRoundCompletedEventSchema,
  TaskRunCompletedEventSchema,
  SecretAccessedEventSchema,
  CompactionTriggeredEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type MessageSentEvent = z.infer<typeof MessageSentEventSchema>;
export type AgentCreatedEvent = z.infer<typeof AgentCreatedEventSchema>;
export type DocumentIngestCompletedEvent = z.infer<typeof DocumentIngestCompletedEventSchema>;
export type PipelinePhaseChangedEvent = z.infer<typeof PipelinePhaseChangedEventSchema>;
export type HarnessRoundCompletedEvent = z.infer<typeof HarnessRoundCompletedEventSchema>;
export type TaskRunCompletedEvent = z.infer<typeof TaskRunCompletedEventSchema>;
export type SecretAccessedEvent = z.infer<typeof SecretAccessedEventSchema>;
export type CompactionTriggeredEvent = z.infer<typeof CompactionTriggeredEventSchema>;
