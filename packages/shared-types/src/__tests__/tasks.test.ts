import { describe, expect, it } from 'vitest';

import {
  CreateTaskInputSchema,
  TaskCategorySchema,
  TaskFiltersSchema,
  TaskPrioritySchema,
  TaskSchema,
  TaskStatusSchema,
  UpdateTaskInputSchema,
} from '../schemas/tasks';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('tasks schemas', () => {
  describe('enums', () => {
    it.each(['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const)(
      'TaskStatusSchema accepts %s',
      (v) => {
        expect(TaskStatusSchema.parse(v)).toBe(v);
      }
    );
    it('TaskStatusSchema rejects invalid', () => {
      expect(() => TaskStatusSchema.parse('nope')).toThrow();
    });

    it.each(['work', 'personal', 'learning', 'health', 'finance', 'other'] as const)(
      'TaskCategorySchema accepts %s',
      (v) => {
        expect(TaskCategorySchema.parse(v)).toBe(v);
      }
    );
    it('TaskCategorySchema rejects invalid', () => {
      expect(() => TaskCategorySchema.parse('nope')).toThrow();
    });

    it.each(['low', 'medium', 'high', 'urgent'] as const)('TaskPrioritySchema accepts %s', (v) => {
      expect(TaskPrioritySchema.parse(v)).toBe(v);
    });
    it('TaskPrioritySchema rejects invalid', () => {
      expect(() => TaskPrioritySchema.parse('nope')).toThrow();
    });
  });

  describe('TaskSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      title: 'My task',
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid task and applies defaults', () => {
      const parsed = TaskSchema.parse(valid);
      expect(parsed.status).toBe('todo');
      expect(parsed.category).toBe('personal');
      expect(parsed.priority).toBe('medium');
      expect(parsed.tags).toEqual([]);
    });
    it('accepts optional description / dueDate / completedAt', () => {
      expect(() =>
        TaskSchema.parse({
          ...valid,
          description: 'desc',
          dueDate: ts,
          completedAt: ts,
        })
      ).not.toThrow();
    });
    it('rejects missing title', () => {
      const { title: _omit, ...rest } = valid;
      expect(() => TaskSchema.parse(rest)).toThrow();
    });
    it('rejects empty title', () => {
      expect(() => TaskSchema.parse({ ...valid, title: '' })).toThrow();
    });
    it('rejects invalid status', () => {
      expect(() => TaskSchema.parse({ ...valid, status: 'nope' })).toThrow();
    });
  });

  describe('CreateTaskInputSchema', () => {
    it('accepts the input subset and applies defaults', () => {
      const parsed = CreateTaskInputSchema.parse({ title: 'T' });
      expect(parsed.status).toBe('todo');
      expect(parsed.tags).toEqual([]);
    });
    it('rejects missing title', () => {
      expect(() => CreateTaskInputSchema.parse({})).toThrow();
    });
  });

  describe('UpdateTaskInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateTaskInputSchema.parse({})).toEqual({});
    });
    it('rejects empty title when provided', () => {
      expect(() => UpdateTaskInputSchema.parse({ title: '' })).toThrow();
    });
  });

  describe('TaskFiltersSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(TaskFiltersSchema.parse({})).toEqual({});
    });
    it('accepts valid filter combination', () => {
      expect(() =>
        TaskFiltersSchema.parse({
          status: 'done',
          category: 'work',
          priority: 'high',
          period: 'last30',
        })
      ).not.toThrow();
    });
    it('rejects invalid status', () => {
      expect(() => TaskFiltersSchema.parse({ status: 'nope' })).toThrow();
    });
    it('rejects invalid period', () => {
      expect(() => TaskFiltersSchema.parse({ period: 'nope' })).toThrow();
    });
  });
});
