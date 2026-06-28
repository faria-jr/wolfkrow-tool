/**
 * Workflow schemas — generic workflow runs
 */

import { z } from 'zod';

import { MetadataSchema, ShortStringSchema, TimestampSchema, UuidSchema } from './common';

export const WorkflowStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowRunSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  workflowName: ShortStringSchema,
  status: WorkflowStatusSchema,
  input: MetadataSchema,
  output: MetadataSchema.optional(),
  error: z.string().optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  metrics: z
    .object({
      durationMs: z.number().int().min(0).optional(),
      tokens: z.number().int().min(0).optional(),
      cost: z.number().min(0).optional(),
    })
    .default({}),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
});

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
