/**
 * Task schemas — kanban/calendar task management
 */

import { z } from 'zod';

import {
  MetadataSchema,
  ShortStringSchema,
  TimestampSchema,
  UuidSchema,
} from './common';

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskCategorySchema = z.enum(['work', 'personal', 'learning', 'health', 'finance', 'other']);

export type TaskCategory = z.infer<typeof TaskCategorySchema>;

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Task
 */
export const TaskSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  title: ShortStringSchema,
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.default('todo'),
  category: TaskCategorySchema.default('personal'),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  tags: z.array(z.string()).default([]),
  metadata: MetadataSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = TaskSchema.omit({
  id: true,
  userId: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = CreateTaskInputSchema.partial();

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

/**
 * Task filters
 */
export const TaskFiltersSchema = z.object({
  status: TaskStatusSchema.optional(),
  category: TaskCategorySchema.optional(),
  priority: TaskPrioritySchema.optional(),
  period: z.enum(['last30', 'last90', 'all']).optional(),
});

export type TaskFilters = z.infer<typeof TaskFiltersSchema>;
