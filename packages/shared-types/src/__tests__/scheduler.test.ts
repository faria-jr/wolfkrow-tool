import { describe, expect, it } from 'vitest';

import {
  CreateScheduledTaskInputSchema,
  CreateScheduledTaskRequestBodySchema,
  ReviewTaskRunRequestBodySchema,
  RunReviewStatusSchema,
  ScheduleStatusSchema,
  ScheduledTaskSchema,
  TaskRunSchema,
  UpdateScheduledTaskInputSchema,
  UpdateScheduledTaskRequestBodySchema,
} from '../schemas/scheduler';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('scheduler schemas', () => {
  describe('enums', () => {
    it.each(['pending', 'running', 'completed', 'failed'] as const)(
      'ScheduleStatusSchema accepts %s',
      (v) => {
        expect(ScheduleStatusSchema.parse(v)).toBe(v);
      },
    );
    it('ScheduleStatusSchema rejects invalid', () => {
      expect(() => ScheduleStatusSchema.parse('nope')).toThrow();
    });

    it.each(['pending', 'running', 'awaiting_review', 'validated', 'rejected'] as const)(
      'RunReviewStatusSchema accepts %s',
      (v) => {
        expect(RunReviewStatusSchema.parse(v)).toBe(v);
      },
    );
    it('RunReviewStatusSchema rejects invalid', () => {
      expect(() => RunReviewStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('ScheduledTaskSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      name: 'Task',
      cronExpression: '0 * * * *',
      prompt: 'do something',
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid task and applies defaults', () => {
      const parsed = ScheduledTaskSchema.parse(valid);
      expect(parsed.timezone).toBe('UTC');
      expect(parsed.enabled).toBe(true);
      expect(parsed.tags).toEqual([]);
      expect(parsed.config).toEqual({});
    });
    it('accepts optional agentId / timestamps', () => {
      expect(() =>
        ScheduledTaskSchema.parse({
          ...valid,
          agentId: uuid,
          lastRunAt: ts,
          nextRunAt: ts,
        }),
      ).not.toThrow();
    });
    it('rejects empty cronExpression', () => {
      expect(() =>
        ScheduledTaskSchema.parse({ ...valid, cronExpression: '' }),
      ).toThrow();
    });
    it('rejects missing prompt', () => {
      const { prompt: _omit, ...rest } = valid;
      expect(() => ScheduledTaskSchema.parse(rest)).toThrow();
    });
  });

  describe('CreateScheduledTaskInputSchema', () => {
    it('accepts the input subset and applies defaults', () => {
      const parsed = CreateScheduledTaskInputSchema.parse({
        name: 'T',
        cronExpression: '0 * * * *',
        prompt: 'p',
      });
      expect(parsed.enabled).toBe(true);
      expect(parsed.tags).toEqual([]);
    });
    it('rejects missing name', () => {
      expect(() =>
        CreateScheduledTaskInputSchema.parse({
          cronExpression: '0 * * * *',
          prompt: 'p',
        }),
      ).toThrow();
    });
  });

  describe('UpdateScheduledTaskInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateScheduledTaskInputSchema.parse({})).toEqual({});
    });
    it('rejects empty cronExpression when provided', () => {
      expect(() =>
        UpdateScheduledTaskInputSchema.parse({ cronExpression: '' }),
      ).toThrow();
    });
  });

  describe('TaskRunSchema', () => {
    const valid = {
      id: uuid,
      taskId: uuid,
      status: 'pending' as const,
    };
    it('accepts a valid run and applies default metrics', () => {
      const parsed = TaskRunSchema.parse(valid);
      expect(parsed.metrics).toEqual({});
    });
    it('accepts optional timestamps / output / error / reviewNote', () => {
      expect(() =>
        TaskRunSchema.parse({
          ...valid,
          startedAt: ts,
          completedAt: ts,
          output: { ok: true },
          error: 'err',
          reviewNote: 'note',
          reviewedAt: ts,
        }),
      ).not.toThrow();
    });
    it('rejects invalid status', () => {
      expect(() =>
        TaskRunSchema.parse({ ...valid, status: 'nope' }),
      ).toThrow();
    });
  });

  describe('ReviewTaskRunRequestBodySchema', () => {
    it.each(['validated', 'rejected'] as const)('accepts verdict %s', (verdict) => {
      expect(() =>
        ReviewTaskRunRequestBodySchema.parse({ verdict }),
      ).not.toThrow();
    });
    it('rejects invalid verdict', () => {
      expect(() =>
        ReviewTaskRunRequestBodySchema.parse({ verdict: 'nope' }),
      ).toThrow();
    });
    it('rejects missing verdict', () => {
      expect(() => ReviewTaskRunRequestBodySchema.parse({})).toThrow();
    });
  });

  describe('CreateScheduledTaskRequestBodySchema', () => {
    it('accepts a valid body', () => {
      expect(() =>
        CreateScheduledTaskRequestBodySchema.parse({
          name: 'T',
          cronExpression: '0 * * * *',
          prompt: 'p',
        }),
      ).not.toThrow();
    });
    it('accepts optional fields', () => {
      expect(() =>
        CreateScheduledTaskRequestBodySchema.parse({
          name: 'T',
          cronExpression: '0 * * * *',
          prompt: 'p',
          description: 'd',
          agentId: uuid,
          tags: ['a'],
        }),
      ).not.toThrow();
    });
    it('rejects missing prompt', () => {
      expect(() =>
        CreateScheduledTaskRequestBodySchema.parse({
          name: 'T',
          cronExpression: '0 * * * *',
        }),
      ).toThrow();
    });
  });

  describe('UpdateScheduledTaskRequestBodySchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateScheduledTaskRequestBodySchema.parse({})).toEqual({});
    });
    it('rejects bad agentId when provided', () => {
      expect(() =>
        UpdateScheduledTaskRequestBodySchema.parse({ agentId: 'nope' }),
      ).toThrow();
    });
  });
});
