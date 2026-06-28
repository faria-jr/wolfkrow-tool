/**
 * Project schemas — central project registration shared by Harness, Pipeline,
 * OpenDesign, Knowledge and Terminal.
 */

import { z } from 'zod';

import { ShortStringSchema, TimestampSchema, UuidSchema } from './common';

export const ProjectStatusSchema = z.enum(['active', 'archived']);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectTagsSchema = z.array(ShortStringSchema).default([]);

export const ProjectSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  name: ShortStringSchema,
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(4096).optional(),
  specPath: z.string().max(4096).optional(),
  defaultProviderId: z.string().max(128).optional(),
  defaultPlannerModel: z.string().max(128).optional(),
  defaultCoderModel: z.string().max(128).optional(),
  tags: ProjectTagsSchema,
  status: ProjectStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = ProjectSchema.pick({
  name: true,
}).extend({
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(4096).optional(),
  specPath: z.string().max(4096).optional(),
  defaultProviderId: z.string().max(128).optional(),
  defaultPlannerModel: z.string().max(128).optional(),
  defaultCoderModel: z.string().max(128).optional(),
  tags: ProjectTagsSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = CreateProjectInputSchema.partial().extend({
  status: ProjectStatusSchema.optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
