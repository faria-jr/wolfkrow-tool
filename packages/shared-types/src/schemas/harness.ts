/**
 * Harness schemas — automated code implementation pipeline
 */

import { z } from 'zod';

import {
  MetadataSchema,
  NonEmptyStringSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const HarnessProjectStatusSchema = z.enum([
  'planning',
  'ready',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export type HarnessProjectStatus = z.infer<typeof HarnessProjectStatusSchema>;

export const SprintStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed']);

export type SprintStatus = z.infer<typeof SprintStatusSchema>;

export const RoundStatusSchema = z.enum([
  'coder_running',
  'evaluator_running',
  'passed',
  'failed',
  'max_rounds_reached',
]);

export type RoundStatus = z.infer<typeof RoundStatusSchema>;

export const HarnessConfigSchema = z.object({
  maxRoundsPerFeature: z.number().int().positive().default(5),
  maxTotalRounds: z.number().int().positive().optional(),
  autoApprove: z.boolean().default(false),
  enableEvaluator: z.boolean().default(true),
  workingDirectory: z.string().optional(),
  additionalMetadata: MetadataSchema.default({}),
});

export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

export const ProjectMetricsSchema = z
  .object({
    totalTokens: z.number().int().min(0).default(0),
    totalCost: z.number().min(0).default(0),
    roundCount: z.number().int().min(0).default(0),
    featuresTotal: z.number().int().min(0).default(0),
    featuresPassed: z.number().int().min(0).default(0),
    totalDurationMs: z.number().int().min(0).default(0),
  })
  .and(MetadataSchema);

export type ProjectMetrics = z.infer<typeof ProjectMetricsSchema>;

export const SprintMetricsSchema = z
  .object({
    totalTokens: z.number().int().min(0).default(0),
    totalCost: z.number().min(0).default(0),
    roundCount: z.number().int().min(0).default(0),
    durationMs: z.number().int().min(0).default(0),
  })
  .and(MetadataSchema);

export type SprintMetrics = z.infer<typeof SprintMetricsSchema>;

export const RoundMetricsSchema = z
  .object({
    inputTokens: z.number().int().min(0).default(0),
    outputTokens: z.number().int().min(0).default(0),
    cost: z.number().min(0).default(0),
    durationMs: z.number().int().min(0).default(0),
    toolUses: z.number().int().min(0).default(0),
    apiRequests: z.number().int().min(0).default(0),
    /**
     * Token usage split by stage. Mirrors the domain `RoundMetrics`
     * fields so the wire shape carries the Coder-vs-Evaluator
     * breakdown the dashboard needs (LionClaw parity). Defaults
     * to 0 so legacy payloads parse.
     */
    coderTokens: z.number().int().min(0).default(0),
    evaluatorTokens: z.number().int().min(0).default(0),
  })
  .and(MetadataSchema);

export type RoundMetrics = z.infer<typeof RoundMetricsSchema>;

/**
 * Feature (within a sprint)
 */
export const FeatureSchema = z.object({
  id: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(2000).optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  priority: z.number().int().min(0).default(0),
  estimatedRounds: z.number().int().positive().default(3),
});

export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Sprint
 */
export const SprintSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  number: z.number().int().positive(),
  name: ShortStringSchema,
  description: z.string().max(2000).optional(),
  status: SprintStatusSchema,
  features: z.array(FeatureSchema).default([]),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  metrics: SprintMetricsSchema,
});

export type Sprint = z.infer<typeof SprintSchema>;

/**
 * Round
 */
export const RoundSchema = z.object({
  id: UuidSchema,
  sprintId: UuidSchema,
  featureIndex: z.number().int().min(0),
  roundNumber: z.number().int().positive(),
  status: RoundStatusSchema,
  coderOutput: z.string().optional(),
  evaluatorFeedback: z.string().optional(),
  metrics: RoundMetricsSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export type Round = z.infer<typeof RoundSchema>;

/**
 * Harness Project
 */
export const HarnessProjectSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(2000).optional(),
  specPath: NonEmptyStringSchema,
  status: HarnessProjectStatusSchema,
  config: HarnessConfigSchema,
  metrics: ProjectMetricsSchema,
  sprints: z.array(SprintSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export type HarnessProject = z.infer<typeof HarnessProjectSchema>;

export const CreateHarnessProjectInputSchema = HarnessProjectSchema.omit({
  id: true,
  userId: true,
  status: true,
  metrics: true,
  sprints: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type CreateHarnessProjectInput = z.infer<typeof CreateHarnessProjectInputSchema>;
