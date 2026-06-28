import { describe, expect, it } from 'vitest';

import {
  Money,
  PricingCalculator,
  defaultPricingCalculator,
  formatCost,
  formatTokens,
  hasKnownPricing,
} from '../pricing-calculator';

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

  it('returns zero for unknown model (no silent fake price)', () => {
    const calc = new PricingCalculator();
    // Unknown models must not produce a fabricated cost — they return $0 AND
    // are flagged as unknown via hasKnownPricing, so callers can log/alert.
    expect(calc.cost('unknown', { inputTokens: 1000, outputTokens: 1000 }).toUSD()).toBe(0);
    expect(hasKnownPricing('unknown')).toBe(false);
  });

  it('cost derives from the registry price (tokens x registry rate, not a local copy)', () => {
    // claude-sonnet-4-6 registry price: $3/M input, $15/M output.
    // 10k input + 10k output => (10_000/1e6)*3 + (10_000/1e6)*15 = 0.03 + 0.15 = 0.18.
    const calc = new PricingCalculator();
    const cost = calc.cost('claude-sonnet-4-6', { inputTokens: 10_000, outputTokens: 10_000 });
    expect(cost.toUSD()).toBe(0.18);
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
    expect(
      defaultPricingCalculator.cost('gpt-4o', { inputTokens: 1000, outputTokens: 0 }).toUSD()
    ).toBe(0.01);
  });
});

describe('multi-preset pricing (RM6)', () => {
  it('glm-4.7 has known pricing and cost > 0', () => {
    expect(hasKnownPricing('glm-4.7')).toBe(true);
    const cost = defaultPricingCalculator.cost('glm-4.7', {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });
    expect(cost.toUSD()).toBeGreaterThan(0);
  });

  it('unknown model has no known pricing', () => {
    expect(hasKnownPricing('totally-unknown-model-xyz')).toBe(false);
  });

  it('kimi-k2-instruct resolves via the catalog (consolidated: no longer needs a preset hint)', () => {
    // P1-5: kimi-k2-instruct is now catalogued under the moonshot provider, so
    // the base (provider-agnostic) lookup finds it — the old divergence (base
    // unknown vs preset known) is gone. Cost is positive from either call.
    const kimiCost = defaultPricingCalculator.cost(
      'kimi-k2-instruct',
      { inputTokens: 1_000_000, outputTokens: 500_000 },
      'moonshot'
    );
    const base = defaultPricingCalculator.cost('kimi-k2-instruct', {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });
    expect(kimiCost.toUSD()).toBeGreaterThan(0);
    expect(base.toUSD()).toBeGreaterThan(0);
    expect(kimiCost.toUSD()).toBe(base.toUSD());
  });

  it('provider-scoped lookup returns unknown when model exists only under a different provider', () => {
    // glm-4.7 is a zai model; asking for it under the moonshot scope is unknown.
    expect(hasKnownPricing('glm-4.7', 'moonshot')).toBe(false);
    expect(hasKnownPricing('glm-4.7', 'zai')).toBe(true);
  });

  it('claude model matched by keyword fallback (opus)', () => {
    expect(hasKnownPricing('claude-opus-4-8')).toBe(true);
  });

  it('formatCost formats sub-cent amounts with 4 decimals', () => {
    expect(formatCost(0.0012)).toBe('$0.0012');
  });

  it('formatCost formats >= 1 cent with 2 decimals', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });

  it('formatTokens formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M');
  });

  it('formatTokens formats thousands', () => {
    expect(formatTokens(1500)).toBe('1.5K');
  });

  it('formatTokens formats small numbers', () => {
    expect(formatTokens(42)).toBe('42');
  });
});
