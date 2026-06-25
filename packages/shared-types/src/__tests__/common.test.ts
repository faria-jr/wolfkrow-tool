import { describe, expect, it } from 'vitest';

import {
  EmailSchema,
  EffortSchema,
  Iso8601Schema,
  JsonValueSchema,
  LongStringSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  PaginatedSchema,
  PaginationInputSchema,
  PercentageSchema,
  PositiveIntSchema,
  RuntimeSchema,
  ShortStringSchema,
  SquadSchema,
  ThemeSchema,
  TimestampSchema,
  UrlSchema,
  UuidSchema,
} from '../schemas/common';

describe('common primitive schemas', () => {
  describe('UuidSchema', () => {
    it('accepts a valid uuid', () => {
      const v = '550e8400-e29b-41d4-a716-446655440000';
      expect(UuidSchema.parse(v)).toBe(v);
    });
    it('rejects a non-uuid', () => {
      expect(() => UuidSchema.parse('not-a-uuid')).toThrow();
    });
  });

  describe('NonEmptyStringSchema', () => {
    it('accepts a non-empty string within bounds', () => {
      expect(NonEmptyStringSchema.parse('hello')).toBe('hello');
    });
    it('rejects empty string', () => {
      expect(() => NonEmptyStringSchema.parse('')).toThrow();
    });
    it('rejects string over 10k chars', () => {
      expect(() => NonEmptyStringSchema.parse('a'.repeat(10_001))).toThrow();
    });
  });

  describe('ShortStringSchema', () => {
    it('accepts a short string', () => {
      expect(ShortStringSchema.parse('hi')).toBe('hi');
    });
    it('rejects empty', () => {
      expect(() => ShortStringSchema.parse('')).toThrow();
    });
    it('rejects over 255 chars', () => {
      expect(() => ShortStringSchema.parse('a'.repeat(256))).toThrow();
    });
  });

  describe('LongStringSchema', () => {
    it('accepts a long string', () => {
      const v = 'a'.repeat(50_000);
      expect(LongStringSchema.parse(v)).toBe(v);
    });
    it('rejects over 100k chars', () => {
      expect(() => LongStringSchema.parse('a'.repeat(100_001))).toThrow();
    });
  });

  describe('UrlSchema', () => {
    it('accepts a valid url', () => {
      expect(UrlSchema.parse('https://example.com')).toBe('https://example.com');
    });
    it('rejects a non-url', () => {
      expect(() => UrlSchema.parse('not a url')).toThrow();
    });
  });

  describe('EmailSchema', () => {
    it('accepts a valid email', () => {
      expect(EmailSchema.parse('a@b.com')).toBe('a@b.com');
    });
    it('rejects an invalid email', () => {
      expect(() => EmailSchema.parse('no-at-sign')).toThrow();
    });
  });

  describe('PositiveIntSchema', () => {
    it('accepts a positive int', () => {
      expect(PositiveIntSchema.parse(5)).toBe(5);
    });
    it('rejects zero', () => {
      expect(() => PositiveIntSchema.parse(0)).toThrow();
    });
    it('rejects negative', () => {
      expect(() => PositiveIntSchema.parse(-1)).toThrow();
    });
    it('rejects non-int', () => {
      expect(() => PositiveIntSchema.parse(1.5)).toThrow();
    });
  });

  describe('NonNegativeIntSchema', () => {
    it('accepts zero', () => {
      expect(NonNegativeIntSchema.parse(0)).toBe(0);
    });
    it('rejects negative', () => {
      expect(() => NonNegativeIntSchema.parse(-1)).toThrow();
    });
  });

  describe('PercentageSchema', () => {
    it('accepts 0 and 100', () => {
      expect(PercentageSchema.parse(0)).toBe(0);
      expect(PercentageSchema.parse(100)).toBe(100);
    });
    it('rejects over 100', () => {
      expect(() => PercentageSchema.parse(101)).toThrow();
    });
    it('rejects negative', () => {
      expect(() => PercentageSchema.parse(-1)).toThrow();
    });
  });

  describe('TimestampSchema', () => {
    it('coerces an ISO string into a Date', () => {
      const d = TimestampSchema.parse('2024-01-01T00:00:00Z');
      expect(d).toBeInstanceOf(Date);
    });
    it('rejects an invalid date string', () => {
      expect(() => TimestampSchema.parse('not-a-date')).toThrow();
    });
  });

  describe('Iso8601Schema', () => {
    it('accepts a valid datetime', () => {
      expect(Iso8601Schema.parse('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
    });
    it('rejects a non-datetime', () => {
      expect(() => Iso8601Schema.parse('2024-01-01')).toThrow();
    });
  });

  describe('JsonValueSchema', () => {
    it('accepts a primitive', () => {
      expect(JsonValueSchema.parse(42)).toBe(42);
      expect(JsonValueSchema.parse('str')).toBe('str');
      expect(JsonValueSchema.parse(true)).toBe(true);
      expect(JsonValueSchema.parse(null)).toBeNull();
    });
    it('accepts nested arrays and records', () => {
      const v = { a: [1, { b: true }] };
      expect(JsonValueSchema.parse(v)).toEqual(v);
    });
    it('rejects undefined (not valid JSON)', () => {
      expect(() => JsonValueSchema.parse(undefined)).toThrow();
    });
  });

  describe('MetadataSchema', () => {
    it('accepts a record and defaults to empty when omitted', () => {
      const parsed = MetadataSchema.parse({ key: 'value' });
      expect(parsed).toEqual({ key: 'value' });
    });
    it('rejects non-record values', () => {
      expect(() => MetadataSchema.parse('string')).toThrow();
    });
  });

  describe('PaginationInputSchema', () => {
    it('applies defaults (limit 20, offset 0)', () => {
      expect(PaginationInputSchema.parse({})).toEqual({ limit: 20, offset: 0 });
    });
    it('rejects limit over 100', () => {
      expect(() => PaginationInputSchema.parse({ limit: 101 })).toThrow();
    });
    it('rejects negative offset', () => {
      expect(() => PaginationInputSchema.parse({ offset: -1 })).toThrow();
    });
  });

  describe('PaginatedSchema', () => {
    it('accepts a valid paginated payload', () => {
      const schema = PaginatedSchema(ShortStringSchema);
      const items = ['a', 'b', 'c'];
      const payload = { items, total: 3, limit: 10, offset: 0, hasMore: false };
      expect(schema.parse(payload)).toEqual(payload);
    });
    it('rejects missing hasMore', () => {
      const schema = PaginatedSchema(ShortStringSchema);
      expect(() =>
        schema.parse({ items: [], total: 0, limit: 10, offset: 0 }),
      ).toThrow();
    });
    it('rejects items not matching the item schema', () => {
      const schema = PaginatedSchema(PositiveIntSchema);
      expect(() =>
        schema.parse({ items: ['not-a-number'], total: 1, limit: 10, offset: 0, hasMore: false }),
      ).toThrow();
    });
  });

  describe('enum schemas', () => {
    it.each(['low', 'medium', 'high', 'max'] as const)('EffortSchema accepts %s', (v) => {
      expect(EffortSchema.parse(v)).toBe(v);
    });
    it('EffortSchema rejects invalid', () => {
      expect(() => EffortSchema.parse('nope')).toThrow();
    });

    it.each(['cloud', 'local', 'codex', 'external', 'claude-compat'] as const)(
      'RuntimeSchema accepts %s',
      (v) => {
        expect(RuntimeSchema.parse(v)).toBe(v);
      },
    );
    it('RuntimeSchema rejects invalid', () => {
      expect(() => RuntimeSchema.parse('nope')).toThrow();
    });

    it.each(['harness', 'workflow', 'enrich', 'custom'] as const)(
      'SquadSchema accepts %s',
      (v) => {
        expect(SquadSchema.parse(v)).toBe(v);
      },
    );
    it('SquadSchema rejects invalid', () => {
      expect(() => SquadSchema.parse('nope')).toThrow();
    });

    it.each(['light', 'dark', 'system'] as const)('ThemeSchema accepts %s', (v) => {
      expect(ThemeSchema.parse(v)).toBe(v);
    });
    it('ThemeSchema rejects invalid', () => {
      expect(() => ThemeSchema.parse('nope')).toThrow();
    });
  });
});
