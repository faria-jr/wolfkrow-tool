import { describe, expect, it } from 'vitest';

import {
  CompactSessionInputSchema,
  CompactionLogEntrySchema,
  CompactionTriggerSchema,
  CreateDailySummaryRequestBodySchema,
  CreateMemoryRequestBodySchema,
  CreateSemanticMemoryInputSchema,
  DailySummarySchema,
  MemorySearchRequestBodySchema,
  SemanticMemorySchema,
} from '../schemas/memory';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('memory schemas', () => {
  describe('CompactionTriggerSchema', () => {
    it.each(['manual', 'token_threshold', 'time_based', 'idle'] as const)(
      'accepts %s',
      (v) => {
        expect(CompactionTriggerSchema.parse(v)).toBe(v);
      },
    );
    it('rejects invalid', () => {
      expect(() => CompactionTriggerSchema.parse('nope')).toThrow();
    });
  });

  describe('SemanticMemorySchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      content: 'a memory',
      source: 'user' as const,
      metadata: {},
      createdAt: ts,
    };
    it('accepts valid memory and applies defaults', () => {
      const parsed = SemanticMemorySchema.parse(valid);
      expect(parsed.importance).toBe(0.5);
      expect(parsed.accessCount).toBe(0);
    });
    it('accepts optional embedding / lastAccessedAt', () => {
      expect(() =>
        SemanticMemorySchema.parse({
          ...valid,
          embedding: [0.1],
          lastAccessedAt: ts,
        }),
      ).not.toThrow();
    });
    it('rejects invalid source', () => {
      expect(() => SemanticMemorySchema.parse({ ...valid, source: 'nope' })).toThrow();
    });
    it('rejects importance out of [0,1]', () => {
      expect(() =>
        SemanticMemorySchema.parse({ ...valid, importance: 2 }),
      ).toThrow();
    });
    it('rejects empty content', () => {
      expect(() => SemanticMemorySchema.parse({ ...valid, content: '' })).toThrow();
    });
  });

  describe('CreateSemanticMemoryInputSchema', () => {
    it('accepts the input subset', () => {
      const parsed = CreateSemanticMemoryInputSchema.parse({
        content: 'mem',
        source: 'agent',
      });
      expect(parsed.importance).toBe(0.5);
    });
    it('rejects missing content', () => {
      expect(() =>
        CreateSemanticMemoryInputSchema.parse({ source: 'user' }),
      ).toThrow();
    });
  });

  describe('DailySummarySchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      date: '2024-01-01',
      content: 'summary',
      metadata: {},
      createdAt: ts,
    };
    it('accepts a valid summary and applies defaults', () => {
      const parsed = DailySummarySchema.parse(valid);
      expect(parsed.sessionCount).toBe(0);
      expect(parsed.tokensUsed).toBe(0);
      expect(parsed.cost).toBe(0);
    });
    it('rejects a bad date format', () => {
      expect(() =>
        DailySummarySchema.parse({ ...valid, date: '01/01/2024' }),
      ).toThrow();
    });
    it('rejects empty content', () => {
      expect(() => DailySummarySchema.parse({ ...valid, content: '' })).toThrow();
    });
  });

  describe('CompactionLogEntrySchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      trigger: 'manual' as const,
      beforeTokens: 1000,
      afterTokens: 500,
      tokensSaved: 500,
      createdAt: ts,
    };
    it('accepts a valid entry', () => {
      expect(() => CompactionLogEntrySchema.parse(valid)).not.toThrow();
    });
    it('accepts optional sessionId / summary', () => {
      expect(() =>
        CompactionLogEntrySchema.parse({
          ...valid,
          sessionId: uuid,
          summary: 'compacted',
        }),
      ).not.toThrow();
    });
    it('rejects negative beforeTokens', () => {
      expect(() =>
        CompactionLogEntrySchema.parse({ ...valid, beforeTokens: -1 }),
      ).toThrow();
    });
  });

  describe('CompactSessionInputSchema', () => {
    it('applies defaults', () => {
      expect(CompactSessionInputSchema.parse({ sessionId: uuid })).toEqual({
        sessionId: uuid,
        trigger: 'manual',
        preserveLastMessages: 10,
      });
    });
    it('rejects non-uuid sessionId', () => {
      expect(() => CompactSessionInputSchema.parse({ sessionId: 'x' })).toThrow();
    });
  });

  describe('CreateMemoryRequestBodySchema', () => {
    it('applies defaults (source=user, importance=50)', () => {
      const parsed = CreateMemoryRequestBodySchema.parse({ content: 'mem' });
      expect(parsed.source).toBe('user');
      expect(parsed.importance).toBe(50);
    });
    it('rejects empty content', () => {
      expect(() => CreateMemoryRequestBodySchema.parse({ content: '' })).toThrow();
    });
    it('rejects importance out of 0-100', () => {
      expect(() =>
        CreateMemoryRequestBodySchema.parse({ content: 'm', importance: 101 }),
      ).toThrow();
    });
  });

  describe('MemorySearchRequestBodySchema', () => {
    it('accepts a valid search', () => {
      expect(() =>
        MemorySearchRequestBodySchema.parse({ query: 'find' }),
      ).not.toThrow();
    });
    it('rejects empty query', () => {
      expect(() => MemorySearchRequestBodySchema.parse({ query: '' })).toThrow();
    });
    it('rejects limit over 100', () => {
      expect(() =>
        MemorySearchRequestBodySchema.parse({ query: 'q', limit: 101 }),
      ).toThrow();
    });
  });

  describe('CreateDailySummaryRequestBodySchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(CreateDailySummaryRequestBodySchema.parse({})).toEqual({});
    });
    it('accepts valid date + content', () => {
      expect(() =>
        CreateDailySummaryRequestBodySchema.parse({
          date: '2024-01-01',
          content: 'sum',
        }),
      ).not.toThrow();
    });
    it('rejects bad date format', () => {
      expect(() =>
        CreateDailySummaryRequestBodySchema.parse({ date: 'nope' }),
      ).toThrow();
    });
  });
});
