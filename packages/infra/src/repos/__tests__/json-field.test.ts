import { describe, it, expect } from 'vitest';

import { fromJson, fromJsonRequired, asJsonField } from '../json-field';

describe('fromJson', () => {
  it('returns value when present', () => {
    expect(fromJson<{ x: number }>({ x: 1 }, { x: 0 })).toEqual({ x: 1 });
  });

  it('returns fallback when null', () => {
    expect(fromJson<{ x: number }>(null, { x: 0 })).toEqual({ x: 0 });
  });

  it('returns fallback when undefined', () => {
    expect(fromJson<{ x: number }>(undefined, { x: 0 })).toEqual({ x: 0 });
  });
});

describe('fromJsonRequired', () => {
  it('returns value when present', () => {
    expect(fromJsonRequired<{ x: number }>({ x: 5 })).toEqual({ x: 5 });
  });

  it('throws when null', () => {
    expect(() => fromJsonRequired(null)).toThrow('Expected non-null JSON field');
  });

  it('throws when undefined', () => {
    expect(() => fromJsonRequired(undefined)).toThrow('Expected non-null JSON field');
  });
});

describe('asJsonField', () => {
  it('casts typed object to Record for Drizzle insert', () => {
    const metrics = { durationMs: 100, stepCount: 3 };
    const result = asJsonField(metrics);
    expect(result).toEqual(metrics);
  });

  it('returns empty object for null/undefined', () => {
    expect(asJsonField(null)).toEqual({});
    expect(asJsonField(undefined)).toEqual({});
  });
});
