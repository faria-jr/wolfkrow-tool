/**
 * Skill schema — Markdown instructions with frontmatter
 */

import { z } from 'zod';

import {
  LongStringSchema,
  MetadataSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

/**
 * Skill frontmatter (YAML at top of SKILL.md)
 */
export const SkillFrontmatterSchema = z.object({
  name: ShortStringSchema,
  description: z.string().max(500),
  version: z.string().default('1.0.0'),
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
  metadata: MetadataSchema.default({}),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

/**
 * Full Skill (frontmatter + body)
 */
export const SkillSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(500),
  content: LongStringSchema,
  tags: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  author: z.string().optional(),
  isBuiltIn: z.boolean().default(false),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Skill = z.infer<typeof SkillSchema>;

export const CreateSkillInputSchema = SkillSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;

export const UpdateSkillInputSchema = CreateSkillInputSchema.partial();

export type UpdateSkillInput = z.infer<typeof UpdateSkillInputSchema>;

/**
 * Create skill request body (web POST /api/skills).
 *
 * Mirrors the handler's lenient coercion: `name`/`description`/`content` accept
 * empty strings (handler defaulted missing values to `''`); `tags` defaults to
 * `[]`. `isBuiltIn` is server-set (`false`), not accepted from the client.
 */
export const CreateSkillRequestBodySchema = z.object({
  name: z.string().max(255).default(''),
  description: z.string().max(500).default(''),
  content: z.string().max(100_000).default(''),
  tags: z.array(z.string()).default([]),
});

export type CreateSkillRequestBody = z.infer<typeof CreateSkillRequestBodySchema>;

/**
 * Update skill request body (web PUT /api/skills/[id]).
 */
export const UpdateSkillRequestBodySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  content: z.string().max(100_000).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateSkillRequestBody = z.infer<typeof UpdateSkillRequestBodySchema>;
