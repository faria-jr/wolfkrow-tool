import { describe, expect, it } from 'vitest';

import { Money, PricingCalculator, defaultPricingCalculator } from '../pricing-calculator';

describe('Money', () => {
  it('creates from USD and rounds to cents', () => {
    expect(Money.of(1.234).usdCents).toBe(123);
  });

  it('adds two amounts', () => {
    expect(Money.of(1).add(Money.of(2)).toUSD()).toBe(3);
  });

  it('zero returns 0 cents', () => {
    expect(Money.zero().usdCents).toBe(0);
  });

  it('converts cents back to USD', () => {
    expect(Money.of(0.99).toUSD()).toBe(0.99);
  });
});

describe('PricingCalculator', () => {
  it('calculates cost for known model', () => {
    const calc = new PricingCalculator();
    const cost = calc.cost('claude-sonnet-4-6', { inputTokens: 10_000, outputTokens: 10_000 });
    expect(cost.toUSD()).toBe(0.18);
  });

  it('returns zero for unknown model', () => {
    const calc = new PricingCalculator();
    expect(calc.cost('unknown', { inputTokens: 1000, outputTokens: 1000 }).toUSD()).toBe(0);
  });

  it('includes cache read and write tokens', () => {
    const calc = new PricingCalculator();
    const cost = calc.cost('claude-opus-4-8', {
      inputTokens: 10_000,
      outputTokens: 10_000,
      cacheReadTokens: 10_000,
      cacheWriteTokens: 10_000,
    });
    expect(cost.toUSD()).toBeGreaterThan(0);
  });

  it('adds custom model tier', () => {
    const calc = new PricingCalculator();
    calc.addModel({ model: 'custom', inputPer1k: 0.01, outputPer1k: 0.02 });
    expect(calc.cost('custom', { inputTokens: 1000, outputTokens: 1000 }).toUSD()).toBe(0.03);
  });

  it('exposes default calculator', () => {
    expect(defaultPricingCalculator.cost('gpt-4o', { inputTokens: 1000, outputTokens: 0 }).toUSD()).toBe(0.01);
  });
});
