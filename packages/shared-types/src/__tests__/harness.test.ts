import { describe, expect, it } from 'vitest';

import {
  CreateHarnessProjectInputSchema,
  FeatureSchema,
  HarnessConfigSchema,
  HarnessProjectSchema,
  HarnessProjectStatusSchema,
  ProjectMetricsSchema,
  RoundMetricsSchema,
  RoundSchema,
  RoundStatusSchema,
  SprintMetricsSchema,
  SprintSchema,
  SprintStatusSchema,
} from '../schemas/harness';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('harness schemas', () => {
  describe('enums', () => {
    it.each(['planning', 'ready', 'running', 'paused', 'completed', 'failed', 'cancelled'] as const)(
      'HarnessProjectStatusSchema accepts %s',
      (v) => {
        expect(HarnessProjectStatusSchema.parse(v)).toBe(v);
      },
    );
    it('HarnessProjectStatusSchema rejects invalid', () => {
      expect(() => HarnessProjectStatusSchema.parse('nope')).toThrow();
    });

    it.each(['pending', 'in_progress', 'completed', 'failed'] as const)(
      'SprintStatusSchema accepts %s',
      (v) => {
        expect(SprintStatusSchema.parse(v)).toBe(v);
      },
    );
    it('SprintStatusSchema rejects invalid', () => {
      expect(() => SprintStatusSchema.parse('nope')).toThrow();
    });

    it.each(['coder_running', 'evaluator_running', 'passed', 'failed', 'max_rounds_reached'] as const)(
      'RoundStatusSchema accepts %s',
      (v) => {
        expect(RoundStatusSchema.parse(v)).toBe(v);
      },
    );
    it('RoundStatusSchema rejects invalid', () => {
      expect(() => RoundStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('HarnessConfigSchema', () => {
    it('applies defaults', () => {
      expect(HarnessConfigSchema.parse({})).toEqual({
        maxRoundsPerFeature: 5,
        autoApprove: false,
        enableEvaluator: true,
        additionalMetadata: {},
      });
    });
    it('rejects non-positive maxRoundsPerFeature', () => {
      expect(() =>
        HarnessConfigSchema.parse({ maxRoundsPerFeature: 0 }),
      ).toThrow();
    });
  });

  describe('metrics schemas (intersection with MetadataSchema)', () => {
    it('ProjectMetricsSchema applies defaults and allows extra metadata keys', () => {
      const parsed = ProjectMetricsSchema.parse({ custom: 'x' });
      expect(parsed.totalTokens).toBe(0);
      expect(parsed).toHaveProperty('custom', 'x');
    });
    it('SprintMetricsSchema applies defaults', () => {
      expect(SprintMetricsSchema.parse({})).toEqual({
        totalTokens: 0,
        totalCost: 0,
        roundCount: 0,
        durationMs: 0,
      });
    });
    it('RoundMetricsSchema applies defaults', () => {
      expect(RoundMetricsSchema.parse({})).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        durationMs: 0,
        toolUses: 0,
        apiRequests: 0,
      });
    });
    it('rejects negative tokens', () => {
      expect(() => ProjectMetricsSchema.parse({ totalTokens: -1 })).toThrow();
    });
  });

  describe('FeatureSchema', () => {
    it('applies defaults', () => {
      expect(FeatureSchema.parse({ id: uuid, name: 'feat' })).toEqual({
        id: uuid,
        name: 'feat',
        acceptanceCriteria: [],
        priority: 0,
        estimatedRounds: 3,
      });
    });
    it('rejects missing name', () => {
      expect(() => FeatureSchema.parse({ id: uuid })).toThrow();
    });
    it('rejects non-positive estimatedRounds', () => {
      expect(() =>
        FeatureSchema.parse({ id: uuid, name: 'f', estimatedRounds: 0 }),
      ).toThrow();
    });
  });

  describe('SprintSchema', () => {
    const valid = {
      id: uuid,
      projectId: uuid,
      number: 1,
      name: 'Sprint 1',
      status: 'pending' as const,
      metrics: {},
    };
    it('accepts a valid sprint with default features', () => {
      expect(SprintSchema.parse(valid).features).toEqual([]);
    });
    it('rejects non-positive number', () => {
      expect(() => SprintSchema.parse({ ...valid, number: 0 })).toThrow();
    });
  });

  describe('RoundSchema', () => {
    const valid = {
      id: uuid,
      sprintId: uuid,
      featureIndex: 0,
      roundNumber: 1,
      status: 'passed' as const,
      metrics: {},
      startedAt: ts,
    };
    it('accepts a valid round', () => {
      expect(() => RoundSchema.parse(valid)).not.toThrow();
    });
    it('rejects non-positive roundNumber', () => {
      expect(() => RoundSchema.parse({ ...valid, roundNumber: 0 })).toThrow();
    });
    it('rejects missing startedAt', () => {
      const { startedAt: _omit, ...rest } = valid;
      expect(() => RoundSchema.parse(rest)).toThrow();
    });
  });

  describe('HarnessProjectSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      name: 'Project',
      specPath: '/spec.md',
      status: 'planning' as const,
      config: {},
      metrics: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid project with default sprints', () => {
      expect(HarnessProjectSchema.parse(valid).sprints).toEqual([]);
    });
    it('rejects invalid status', () => {
      expect(() =>
        HarnessProjectSchema.parse({ ...valid, status: 'nope' }),
      ).toThrow();
    });
  });

  describe('CreateHarnessProjectInputSchema', () => {
    it('accepts the input subset', () => {
      const input = { name: 'Proj', specPath: '/spec.md', config: {} };
      expect(() => CreateHarnessProjectInputSchema.parse(input)).not.toThrow();
    });
    it('rejects missing specPath', () => {
      expect(() =>
        CreateHarnessProjectInputSchema.parse({ name: 'Proj', config: {} }),
      ).toThrow();
    });
    it('rejects missing config (config is required in create input)', () => {
      expect(() =>
        CreateHarnessProjectInputSchema.parse({ name: 'Proj', specPath: '/spec.md' }),
      ).toThrow();
    });
  });
});
