/**
 * Common primitive schemas used across all domains
 */

import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const NonEmptyStringSchema = z.string().min(1).max(10_000);

export const ShortStringSchema = z.string().min(1).max(255);

export const LongStringSchema = z.string().min(1).max(100_000);

export const UrlSchema = z.string().url();

export const EmailSchema = z.string().email();

export const PositiveIntSchema = z.number().int().positive();

export const NonNegativeIntSchema = z.number().int().min(0);

export const PercentageSchema = z.number().min(0).max(100);

export const TimestampSchema = z.coerce.date();

export const Iso8601Schema = z.string().datetime();

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

export const MetadataSchema = z.record(z.string(), JsonValueSchema).default({});

/**
 * Pagination
 */

export const PaginationInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof PaginationInputSchema>;

export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().positive(),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  });

/**
 * Common enums (reused across schemas)
 */

export const EffortSchema = z.enum(['low', 'medium', 'high', 'max']);

export const RuntimeSchema = z.enum(['cloud', 'local', 'codex', 'external']);

export const SquadSchema = z.enum(['harness', 'workflow', 'enrich', 'custom']);

export const ThemeSchema = z.enum(['light', 'dark', 'system']);

export type Effort = z.infer<typeof EffortSchema>;
export type Runtime = z.infer<typeof RuntimeSchema>;
export type Squad = z.infer<typeof SquadSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
