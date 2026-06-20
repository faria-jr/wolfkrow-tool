import { describe, expect, it } from 'vitest';

import { cn, formatCurrency, formatDuration, truncate, generateId } from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('p-2 p-4')).toBe('p-4');
  });
});

describe('formatCurrency', () => {
  it('formats USD with 4 decimals', () => {
    expect(formatCurrency(0.000123)).toBe('$0.0001');
    expect(formatCurrency(1.5)).toBe('$1.5000');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to human-readable', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(3_661_000)).toBe('1h 1m 1s');
    expect(formatDuration(86_400_000)).toBe('1d 0h 0m');
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello world', 8)).toBe('Hello...');
    expect(truncate('Hi', 8)).toBe('Hi');
  });
});

describe('generateId', () => {
  it('generates UUID-like strings', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});
