import { describe, expect, it } from 'vitest';

import { statusBadgeVariant } from '../status-badge';

describe('statusBadgeVariant (DEBT #14b)', () => {
  it('maps success statuses to default', () => {
    expect(statusBadgeVariant('completed')).toBe('default');
    expect(statusBadgeVariant('done')).toBe('default');
    expect(statusBadgeVariant('active')).toBe('default');
    expect(statusBadgeVariant('passed')).toBe('default');
  });

  it('maps running statuses to secondary', () => {
    expect(statusBadgeVariant('running')).toBe('secondary');
    expect(statusBadgeVariant('in_progress')).toBe('secondary');
    expect(statusBadgeVariant('planning')).toBe('secondary');
  });

  it('maps failure statuses to destructive', () => {
    expect(statusBadgeVariant('failed')).toBe('destructive');
    expect(statusBadgeVariant('cancelled')).toBe('destructive');
    expect(statusBadgeVariant('rejected')).toBe('destructive');
  });

  it('falls back to outline for unknown/idle', () => {
    expect(statusBadgeVariant('idle')).toBe('outline');
    expect(statusBadgeVariant('unknown')).toBe('outline');
    expect(statusBadgeVariant('')).toBe('outline');
  });

  it('is case-insensitive', () => {
    expect(statusBadgeVariant('RUNNING')).toBe('secondary');
    expect(statusBadgeVariant('Failed')).toBe('destructive');
  });
});
