import { describe, expect, it } from 'vitest';

import { WorkflowRunSchema, WorkflowStatusSchema } from '../schemas/workflow';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('workflow schemas', () => {
  describe('WorkflowStatusSchema', () => {
    it.each(['pending', 'running', 'completed', 'failed', 'cancelled'] as const)(
      'accepts %s',
      (v) => {
        expect(WorkflowStatusSchema.parse(v)).toBe(v);
      }
    );
    it('rejects invalid', () => {
      expect(() => WorkflowStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('WorkflowRunSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      workflowName: 'my-workflow',
      status: 'running' as const,
      input: {},
      metadata: {},
      createdAt: ts,
    };
    it('accepts a valid run and applies default metrics', () => {
      const parsed = WorkflowRunSchema.parse(valid);
      expect(parsed.metrics).toEqual({});
    });
    it('accepts optional output / error / timestamps', () => {
      expect(() =>
        WorkflowRunSchema.parse({
          ...valid,
          output: { result: 'ok' },
          error: 'none',
          startedAt: ts,
          completedAt: ts,
        })
      ).not.toThrow();
    });
    it('rejects invalid status', () => {
      expect(() => WorkflowRunSchema.parse({ ...valid, status: 'nope' })).toThrow();
    });
    it('rejects missing workflowName', () => {
      const { workflowName: _omit, ...rest } = valid;
      expect(() => WorkflowRunSchema.parse(rest)).toThrow();
    });
    it('rejects non-uuid id', () => {
      expect(() => WorkflowRunSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });
});
