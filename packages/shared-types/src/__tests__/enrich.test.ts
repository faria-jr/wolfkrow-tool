import { describe, expect, it } from 'vitest';

import {
  CreateEnrichSessionInputSchema,
  EnrichMessageSchema,
  EnrichSessionSchema,
  EnrichSessionStatusSchema,
} from '../schemas/enrich';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('enrich schemas', () => {
  describe('EnrichSessionStatusSchema', () => {
    it.each(['pending', 'validator', 'enricher', 'completed', 'cancelled'] as const)(
      'accepts %s',
      (v) => {
        expect(EnrichSessionStatusSchema.parse(v)).toBe(v);
      },
    );
    it('rejects invalid', () => {
      expect(() => EnrichSessionStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('EnrichSessionSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      specPath: '/path/to/spec.md',
      status: 'pending' as const,
      metadata: {},
    };

    it('accepts a valid session and applies defaults for metrics', () => {
      const parsed = EnrichSessionSchema.parse(valid);
      expect(parsed.validatorMetrics).toEqual({
        tokens: 0,
        cost: 0,
        durationMs: 0,
      });
      expect(parsed.enricherMetrics).toEqual({
        tokens: 0,
        cost: 0,
        durationMs: 0,
      });
    });

    it('accepts optional agent ids and timestamps', () => {
      const withOpts = {
        ...valid,
        validatorAgentId: uuid,
        enricherAgentId: uuid,
        startedAt: ts,
        completedAt: ts,
      };
      expect(() => EnrichSessionSchema.parse(withOpts)).not.toThrow();
    });

    it('rejects missing specPath', () => {
      const { specPath: _omit, ...rest } = valid;
      expect(() => EnrichSessionSchema.parse(rest)).toThrow();
    });

    it('rejects invalid status', () => {
      expect(() =>
        EnrichSessionSchema.parse({ ...valid, status: 'nope' }),
      ).toThrow();
    });

    it('rejects non-uuid id', () => {
      expect(() => EnrichSessionSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });

  describe('EnrichMessageSchema', () => {
    const valid = {
      id: uuid,
      sessionId: uuid,
      role: 'user' as const,
      content: 'hello',
      createdAt: ts,
    };

    it('accepts a valid message', () => {
      expect(() => EnrichMessageSchema.parse(valid)).not.toThrow();
    });

    it.each(['user', 'validator', 'enricher', 'system'] as const)(
      'accepts role %s',
      (role) => {
        expect(() =>
          EnrichMessageSchema.parse({ ...valid, role }),
        ).not.toThrow();
      },
    );

    it('rejects invalid role', () => {
      expect(() =>
        EnrichMessageSchema.parse({ ...valid, role: 'nope' }),
      ).toThrow();
    });

    it('rejects empty content', () => {
      expect(() =>
        EnrichMessageSchema.parse({ ...valid, content: '' }),
      ).toThrow();
    });
  });

  describe('CreateEnrichSessionInputSchema', () => {
    it('accepts the input subset', () => {
      const input = { specPath: '/spec.md' };
      expect(CreateEnrichSessionInputSchema.parse(input)).toEqual(input);
    });
    it('rejects missing specPath', () => {
      expect(() => CreateEnrichSessionInputSchema.parse({})).toThrow();
    });
  });
});
