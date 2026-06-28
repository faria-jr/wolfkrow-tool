/**
 * Scheduler schemas — cron tasks, runs, activities
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const ScheduleStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const RunReviewStatusSchema = z.enum([
  'pending',
  'running',
  'awaiting_review',
  'validated',
  'rejected',
]);

export type RunReviewStatus = z.infer<typeof RunReviewStatusSchema>;

/**
 * Scheduled Task
 */
export const ScheduledTaskSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  cronExpression: NonEmptyStringSchema,
  timezone: z.string().default('UTC'),
  prompt: NonEmptyStringSchema,
  agentId: UuidSchema.optional(),
  enabled: z.boolean().default(true),
  lastRunAt: TimestampSchema.optional(),
  nextRunAt: TimestampSchema.optional(),
  config: MetadataSchema,
  tags: z.array(z.string()).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ScheduledTask = z.infer<typeof ScheduledTaskSchema>;

export const CreateScheduledTaskInputSchema = ScheduledTaskSchema.omit({
  id: true,
  userId: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateScheduledTaskInput = z.infer<typeof CreateScheduledTaskInputSchema>;

export const UpdateScheduledTaskInputSchema = CreateScheduledTaskInputSchema.partial();

export type UpdateScheduledTaskInput = z.infer<typeof UpdateScheduledTaskInputSchema>;

/**
 * Task Run (execution)
 */
export const TaskRunSchema = z.object({
  id: UuidSchema,
  taskId: UuidSchema,
  status: RunReviewStatusSchema,
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  reviewNote: z.string().max(5000).optional(),
  reviewedAt: TimestampSchema.optional(),
  metrics: z
    .object({
      tokens: z.number().int().min(0).optional(),
      cost: z.number().min(0).optional(),
      durationMs: z.number().int().min(0).optional(),
      toolUses: z.number().int().min(0).optional(),
    })
    .default({}),
});

export type TaskRun = z.infer<typeof TaskRunSchema>;

/**
 * Task-run review request body (web POST /api/scheduler/runs/[id]/review).
 */
export const ReviewTaskRunRequestBodySchema = z.object({
  verdict: z.enum(['validated', 'rejected']),
  note: z.string().max(5000).optional(),
});

export type ReviewTaskRunRequestBody = z.infer<typeof ReviewTaskRunRequestBodySchema>;

/**
 * Create scheduled-task request body (web POST /api/scheduler/tasks).
 *
 * Subset of {@link CreateScheduledTaskInputSchema}: the web handler only
 * accepts `name`, `cronExpression`, `prompt` (required) plus optional
 * `description`, `agentId`, `tags`. Optional fields are omitted from the
 * use-case call when absent (hence `.optional()` without defaults).
 */
export const CreateScheduledTaskRequestBodySchema = z.object({
  name: ShortStringSchema,
  description: z.string().max(1000).optional(),
  cronExpression: NonEmptyStringSchema,
  prompt: NonEmptyStringSchema,
  agentId: UuidSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateScheduledTaskRequestBody = z.infer<typeof CreateScheduledTaskRequestBodySchema>;

/**
 * Update scheduled-task request body (web PATCH /api/scheduler/tasks/[id]).
 *
 * Hand-written partial aligned with the use-case `UpdateScheduledTaskInput`
 * (the handler only forwards these fields). Keeps the inferred output type
 * clean under `exactOptionalPropertyTypes`.
 */
export const UpdateScheduledTaskRequestBodySchema = z.object({
  name: ShortStringSchema.optional(),
  description: z.string().max(1000).optional(),
  cronExpression: NonEmptyStringSchema.optional(),
  prompt: NonEmptyStringSchema.optional(),
  agentId: UuidSchema.optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateScheduledTaskRequestBody = z.infer<typeof UpdateScheduledTaskRequestBodySchema>;
