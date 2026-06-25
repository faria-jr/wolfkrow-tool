import { lookupModelPricing, type ModelPricing } from './provider-registry';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface PricingTier {
  model: string;
  inputPer1k: number;   // USD
  outputPer1k: number;  // USD
  cacheReadPer1k?: number;
  cacheWritePer1k?: number;
}

/** Immutable money value in USD cents */
export class Money {
  private constructor(readonly usdCents: number) {}

  static of(usd: number): Money {
    return new Money(Math.round(usd * 100));
  }

  add(other: Money): Money {
    return new Money(this.usdCents + other.usdCents);
  }

  toUSD(): number {
    return this.usdCents / 100;
  }

  static zero(): Money {
    return new Money(0);
  }
}

/**
 * Resolve pricing for a model from the canonical {@link MODEL_CATALOG}
 * (via {@link lookupModelPricing}). The optional `presetId` is the legacy name
 * for a provider id (zai/minimax/moonshot/qwen) — passed through as the
 * provider scope so a model name shared across providers resolves correctly.
 *
 * A keyword fallback covers legacy Claude model strings not in the catalog.
 * Returns `undefined` when no pricing is known — callers MUST treat that as
 * "unknown" (not a silent $0).
 */
function resolvePricing(model: string, presetId?: string): ModelPricing | undefined {
  const fromCatalog = lookupModelPricing(model, presetId);
  if (fromCatalog) return fromCatalog;

  // Keyword fallback for Claude model families whose exact id isn't catalogued.
  const key = model.toLowerCase();
  if (key.includes('opus')) {
    return lookupModelPricing('claude-opus-4-8');
  }
  if (key.includes('haiku')) {
    return lookupModelPricing('claude-haiku-4-5-20251001');
  }
  if (key.includes('sonnet') || key.includes('claude')) {
    return lookupModelPricing('claude-sonnet-4-6');
  }

  return undefined;
}

function pricingToMoney(pricing: ModelPricing, usage: TokenUsage): Money {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const pureInput = usage.inputTokens - cacheRead - cacheWrite;

  const usd =
    (pureInput / 1_000_000) * pricing.inputPerMTok +
    (cacheRead / 1_000_000) * (pricing.cacheReadPerMTok ?? 0) +
    (cacheWrite / 1_000_000) * (pricing.cacheCreationPerMTok ?? 0) +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;

  return Money.of(usd);
}

const LEGACY_PRICING: PricingTier[] = [
  // Kept for backward-compat with callers using PricingTier directly
  { model: 'whisper-1', inputPer1k: 0, outputPer1k: 0 },
  { model: 'eleven_monolingual_v1', inputPer1k: 0, outputPer1k: 0 },
  { model: 'sonic-english', inputPer1k: 0, outputPer1k: 0 },
];

export class PricingCalculator {
  private readonly customTiers: Map<string, PricingTier>;

  constructor(tiers: PricingTier[] = LEGACY_PRICING) {
    this.customTiers = new Map(tiers.map((t) => [t.model, t]));
  }

  /**
   * Cost for a turn. Unknown models return {@link Money.zero} — check
   * {@link hasKnownPricing} to distinguish "unknown" from a genuine $0 price.
   */
  cost(model: string, usage: TokenUsage, presetId?: string): Money {
    const pricing = resolvePricing(model, presetId);
    if (pricing) return pricingToMoney(pricing, usage);

    const legacy = this.customTiers.get(model);
    if (legacy) {
      let usd =
        (legacy.inputPer1k * usage.inputTokens) / 1000 +
        (legacy.outputPer1k * usage.outputTokens) / 1000;
      if (legacy.cacheReadPer1k && usage.cacheReadTokens) {
        usd += (legacy.cacheReadPer1k * usage.cacheReadTokens) / 1000;
      }
      if (legacy.cacheWritePer1k && usage.cacheWriteTokens) {
        usd += (legacy.cacheWritePer1k * usage.cacheWriteTokens) / 1000;
      }
      return Money.of(usd);
    }

    return Money.zero();
  }

  addModel(tier: PricingTier): void {
    this.customTiers.set(tier.model, tier);
  }
}

export function hasKnownPricing(model: string, presetId?: string): boolean {
  return resolvePricing(model, presetId) !== undefined;
}

export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export const defaultPricingCalculator = new PricingCalculator();
