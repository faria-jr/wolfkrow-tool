import { describe, expect, it } from 'vitest';

import { UsageSummarySchema } from '../schemas/usage';

describe('UsageSummarySchema', () => {
  const valid = {
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUSD: 0.5,
    byModel: { 'gpt-4o': { inputTokens: 100, outputTokens: 50, costUSD: 0.1 } },
    bySource: { chat: { inputTokens: 100, outputTokens: 50, costUSD: 0.1 } },
    byDay: [
      { day: '2024-01-01', inputTokens: 100, outputTokens: 50, costUSD: 0.1 },
    ],
  };

  it('accepts a valid summary payload', () => {
    expect(UsageSummarySchema.parse(valid)).toEqual(valid);
  });

  it('accepts empty aggregation (zero totals, empty maps, empty byDay array)', () => {
    const empty = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      byModel: {},
      bySource: {},
      byDay: [],
    };
    expect(UsageSummarySchema.parse(empty)).toEqual(empty);
  });

  it('rejects negative token totals', () => {
    expect(() =>
      UsageSummarySchema.parse({ ...valid, totalInputTokens: -1 }),
    ).toThrow();
  });

  it('rejects a non-array byDay (Record shape is invalid)', () => {
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: { '2024-01-01': { inputTokens: 1, outputTokens: 1, costUSD: 0 } },
      }),
    ).toThrow();
  });

  it('rejects a byDay entry with an invalid date format', () => {
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: [{ day: '01/01/2024', inputTokens: 1, outputTokens: 1, costUSD: 0 }],
      }),
    ).toThrow();
  });

  it('rejects impossible calendar dates that match the format regex', () => {
    // Month 13 — matches \d{4}-\d{2}-\d{2} but is not a real date.
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: [{ day: '2024-13-45', inputTokens: 1, outputTokens: 1, costUSD: 0 }],
      }),
    ).toThrow();
    // Feb 30 never exists.
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: [{ day: '2024-02-30', inputTokens: 1, outputTokens: 1, costUSD: 0 }],
      }),
    ).toThrow();
    // Feb 29 only exists in leap years — 2025 is not a leap year.
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: [{ day: '2025-02-29', inputTokens: 1, outputTokens: 1, costUSD: 0 }],
      }),
    ).toThrow();
  });

  it('accepts Feb 29 in a leap year', () => {
    expect(() =>
      UsageSummarySchema.parse({
        ...valid,
        byDay: [{ day: '2024-02-29', inputTokens: 1, outputTokens: 1, costUSD: 0 }],
      }),
    ).not.toThrow();
  });

  it('rejects missing totalCostUSD', () => {
    const { totalCostUSD: _omit, ...rest } = valid;
    expect(() => UsageSummarySchema.parse(rest)).toThrow();
  });
});
