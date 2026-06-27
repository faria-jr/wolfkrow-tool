import { describe, expect, it } from 'vitest';

import {
  CreatePipelineProjectInputSchema,
  PhaseMetricsSchema,
  PipelineMessageSchema,
  PipelineMetricsSchema,
  PipelinePhaseSchema,
  PipelineProjectSchema,
  PipelineStageSchema,
  PipelineStatusSchema,
  PhaseStatusSchema,
} from '../schemas/pipeline';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('pipeline schemas', () => {
  describe('enums', () => {
    it.each(['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed'] as const)(
      'PipelineStageSchema accepts %s',
      (v) => {
        expect(PipelineStageSchema.parse(v)).toBe(v);
      },
    );
    it('PipelineStageSchema rejects invalid', () => {
      expect(() => PipelineStageSchema.parse('nope')).toThrow();
    });

    it.each(['running', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled'] as const)(
      'PipelineStatusSchema accepts %s',
      (v) => {
        expect(PipelineStatusSchema.parse(v)).toBe(v);
      },
    );
    it('PipelineStatusSchema rejects invalid', () => {
      expect(() => PipelineStatusSchema.parse('nope')).toThrow();
    });

    it.each(['pending', 'in_progress', 'awaiting_user', 'completed', 'failed', 'skipped'] as const)(
      'PhaseStatusSchema accepts %s',
      (v) => {
        expect(PhaseStatusSchema.parse(v)).toBe(v);
      },
    );
    it('PhaseStatusSchema rejects invalid', () => {
      expect(() => PhaseStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('metrics schemas', () => {
    it('PhaseMetricsSchema applies defaults and allows metadata keys', () => {
      const parsed = PhaseMetricsSchema.parse({ custom: 'x' });
      expect(parsed.tokens).toBe(0);
      expect(parsed).toHaveProperty('custom', 'x');
    });
    it('PipelineMetricsSchema applies defaults', () => {
      expect(PipelineMetricsSchema.parse({})).toEqual({
        totalTokens: 0,
        totalCost: 0,
        totalDurationMs: 0,
        phasesCompleted: 0,
      });
    });
    it('rejects negative tokens', () => {
      expect(() => PhaseMetricsSchema.parse({ tokens: -1 })).toThrow();
    });
  });

  describe('PipelinePhaseSchema', () => {
    const valid = {
      id: uuid,
      projectId: uuid,
      stage: 'discovery' as const,
      status: 'pending' as const,
      metrics: {},
    };
    it('accepts a valid phase', () => {
      expect(() => PipelinePhaseSchema.parse(valid)).not.toThrow();
    });
    it('accepts optional artifact / timestamps', () => {
      expect(() =>
        PipelinePhaseSchema.parse({
          ...valid,
          artifactPath: '/art',
          startedAt: ts,
          completedAt: ts,
        }),
      ).not.toThrow();
    });
    it('rejects invalid stage', () => {
      expect(() => PipelinePhaseSchema.parse({ ...valid, stage: 'nope' })).toThrow();
    });
  });

  describe('PipelineMessageSchema', () => {
    const valid = {
      id: uuid,
      projectId: uuid,
      phaseId: uuid,
      role: 'user' as const,
      content: 'hello',
      createdAt: ts,
    };
    it('accepts a valid message', () => {
      expect(() => PipelineMessageSchema.parse(valid)).not.toThrow();
    });
    it.each(['user', 'assistant', 'system'] as const)('accepts role %s', (role) => {
      expect(() => PipelineMessageSchema.parse({ ...valid, role })).not.toThrow();
    });
    it('rejects invalid role', () => {
      expect(() => PipelineMessageSchema.parse({ ...valid, role: 'nope' })).toThrow();
    });
    it('rejects empty content', () => {
      expect(() => PipelineMessageSchema.parse({ ...valid, content: '' })).toThrow();
    });
  });

  describe('PipelineProjectSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      name: 'Proj',
      currentStage: 'discovery' as const,
      status: 'running' as const,
      metrics: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid project', () => {
      expect(() => PipelineProjectSchema.parse(valid)).not.toThrow();
    });
    it('accepts optional notes/paths', () => {
      expect(
        PipelineProjectSchema.parse({
          ...valid,
          discoveryNotes: 'notes',
          projectPath: '/tmp/repo',
          specPath: '/spec',
          prdPath: '/prd',
          approvalNotes: 'ok',
        }),
      ).toHaveProperty('projectPath', '/tmp/repo');
    });
    it('rejects missing name', () => {
      const { name: _omit, ...rest } = valid;
      expect(() => PipelineProjectSchema.parse(rest)).toThrow();
    });
  });

  describe('CreatePipelineProjectInputSchema', () => {
    it('accepts the input subset (name + description + projectPath)', () => {
      expect(
        CreatePipelineProjectInputSchema.parse({
          name: 'Proj',
          description: 'desc',
          projectPath: '/tmp/repo',
        }),
      ).toHaveProperty('projectPath', '/tmp/repo');
    });
    it('rejects missing name', () => {
      expect(() => CreatePipelineProjectInputSchema.parse({})).toThrow();
    });
  });
});
