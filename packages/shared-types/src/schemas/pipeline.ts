/**
 * Pipeline schemas — BuildPlan multi-stage workflow
 */

import { z } from 'zod';

import {
  LongStringSchema,
  MetadataSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const PipelineStageSchema = z.enum([
  'discovery',
  'spec_build',
  'spec_validate',
  'approval',
  'implementation',
  'completed',
]);

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PipelineStatusSchema = z.enum([
  'running',
  'paused',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

export const PhaseStatusSchema = z.enum([
  'pending',
  'in_progress',
  'awaiting_user',
  'completed',
  'failed',
  'skipped',
]);

export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const PhaseMetricsSchema = z
  .object({
    tokens: z.number().int().min(0).default(0),
    cost: z.number().min(0).default(0),
    durationMs: z.number().int().min(0).default(0),
    rounds: z.number().int().min(0).default(0),
  })
  .and(MetadataSchema);

export type PhaseMetrics = z.infer<typeof PhaseMetricsSchema>;

export const PipelineMetricsSchema = z
  .object({
    totalTokens: z.number().int().min(0).default(0),
    totalCost: z.number().min(0).default(0),
    totalDurationMs: z.number().int().min(0).default(0),
    phasesCompleted: z.number().int().min(0).default(0),
  })
  .and(MetadataSchema);

export type PipelineMetrics = z.infer<typeof PipelineMetricsSchema>;

/**
 * Pipeline Phase
 */
export const PipelinePhaseSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  stage: PipelineStageSchema,
  status: PhaseStatusSchema,
  artifactPath: z.string().optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  metrics: PhaseMetricsSchema,
});

export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>;

/**
 * Pipeline Message (chat in a phase)
 */
export const PipelineMessageSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  phaseId: UuidSchema,
  role: z.enum(['user', 'assistant', 'system']),
  content: LongStringSchema,
  createdAt: TimestampSchema,
});

export type PipelineMessage = z.infer<typeof PipelineMessageSchema>;

/**
 * Pipeline Project
 */
export const PipelineProjectSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(2000).optional(),
  currentStage: PipelineStageSchema,
  status: PipelineStatusSchema,
  discoveryNotes: LongStringSchema.optional(),
  projectPath: z.string().max(4096).optional(),
  specPath: z.string().optional(),
  prdPath: z.string().optional(),
  approvalNotes: z.string().max(5000).optional(),
  metrics: PipelineMetricsSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export type PipelineProject = z.infer<typeof PipelineProjectSchema>;

export const CreatePipelineProjectInputSchema = PipelineProjectSchema.omit({
  id: true,
  userId: true,
  currentStage: true,
  status: true,
  discoveryNotes: true,
  specPath: true,
  prdPath: true,
  approvalNotes: true,
  metrics: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type CreatePipelineProjectInput = z.infer<typeof CreatePipelineProjectInputSchema>;
