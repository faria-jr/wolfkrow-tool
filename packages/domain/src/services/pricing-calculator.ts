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

const DEFAULT_PRICING: PricingTier[] = [
  // Anthropic
  { model: 'claude-opus-4-8', inputPer1k: 0.015, outputPer1k: 0.075, cacheReadPer1k: 0.0015, cacheWritePer1k: 0.01875 },
  { model: 'claude-sonnet-4-6', inputPer1k: 0.003, outputPer1k: 0.015, cacheReadPer1k: 0.0003, cacheWritePer1k: 0.00375 },
  { model: 'claude-haiku-4-5-20251001', inputPer1k: 0.00025, outputPer1k: 0.00125 },
  // OpenAI
  { model: 'gpt-4o', inputPer1k: 0.005, outputPer1k: 0.015 },
  { model: 'gpt-4o-mini', inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { model: 'whisper-1', inputPer1k: 0 /* per-minute billing */, outputPer1k: 0 },
  // ElevenLabs / Cartesia — zero token cost
  { model: 'eleven_monolingual_v1', inputPer1k: 0, outputPer1k: 0 },
  { model: 'sonic-english', inputPer1k: 0, outputPer1k: 0 },
];

export class PricingCalculator {
  private readonly tierMap: Map<string, PricingTier>;

  constructor(tiers: PricingTier[] = DEFAULT_PRICING) {
    this.tierMap = new Map(tiers.map((t) => [t.model, t]));
  }

  cost(model: string, usage: TokenUsage): Money {
    const tier = this.tierMap.get(model);
    if (!tier) return Money.zero(); // unknown model — 0 cost rather than error

    let usd =
      (tier.inputPer1k * usage.inputTokens) / 1000 +
      (tier.outputPer1k * usage.outputTokens) / 1000;

    if (tier.cacheReadPer1k && usage.cacheReadTokens) {
      usd += (tier.cacheReadPer1k * usage.cacheReadTokens) / 1000;
    }
    if (tier.cacheWritePer1k && usage.cacheWriteTokens) {
      usd += (tier.cacheWritePer1k * usage.cacheWriteTokens) / 1000;
    }

    return Money.of(usd);
  }

  addModel(tier: PricingTier): void {
    this.tierMap.set(tier.model, tier);
  }
}

export const defaultPricingCalculator = new PricingCalculator();
