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

interface PricingEntry {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

const MODEL_PRICING: Record<string, PricingEntry> = {
  // Anthropic
  'claude-opus-4-8':            { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheCreation: 6.25  },
  'claude-opus-4-7':            { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheCreation: 6.25  },
  'claude-opus-4-6':            { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheCreation: 6.25  },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheCreation: 3.75  },
  'claude-haiku-4-5-20251001':  { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheCreation: 1.25  },
  'claude-sonnet-4-5-20250514': { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheCreation: 3.75  },
  'claude-haiku-3-5-20241022':  { input: 0.80,  output: 4.00,  cacheRead: 0.08,  cacheCreation: 1.00  },
  // OpenAI
  'gpt-4o':        { input: 5.00,  output: 15.00, cacheRead: 0.50,  cacheCreation: 0 },
  'gpt-4.1':       { input: 5.00,  output: 15.00, cacheRead: 0.50,  cacheCreation: 0 },
  'gpt-4o-mini':   { input: 0.15,  output: 0.60,  cacheRead: 0.015, cacheCreation: 0 },
  'o3':            { input: 10.00, output: 40.00, cacheRead: 1.00,  cacheCreation: 0 },
  // Z.ai GLM
  'glm-4.7':       { input: 0.38,  output: 1.74,  cacheRead: 0,     cacheCreation: 0 },
  'glm-4.5-air':   { input: 0.14,  output: 0.56,  cacheRead: 0,     cacheCreation: 0 },
  'glm-5.1':       { input: 1.00,  output: 4.00,  cacheRead: 0,     cacheCreation: 0 },
  'glm-5-turbo':   { input: 0.50,  output: 2.00,  cacheRead: 0,     cacheCreation: 0 },
  // MiniMax
  'minimax-m2.7':  { input: 0.30,  output: 1.20,  cacheRead: 0.06,  cacheCreation: 0.375 },
  'minimax-m2.5':  { input: 0.30,  output: 1.20,  cacheRead: 0.03,  cacheCreation: 0.375 },
  'minimax-m3':    { input: 0.60,  output: 2.40,  cacheRead: 0.12,  cacheCreation: 0.375 },
  // Qwen
  'qwen3-max':         { input: 0.40,  output: 1.20,  cacheRead: 0, cacheCreation: 0 },
  'qwen3-coder-plus':  { input: 1.00,  output: 5.00,  cacheRead: 0, cacheCreation: 0 },
  // Kimi direct
  'kimi-k2.6':     { input: 0.95,  output: 4.00,  cacheRead: 0.16, cacheCreation: 0 },
  // OpenRouter prefixed
  'or:deepseek/deepseek-v4-pro':   { input: 0.435,  output: 0.87,  cacheRead: 0.10,  cacheCreation: 0 },
  'or:z-ai/glm-4.7':               { input: 0.38,   output: 1.74,  cacheRead: 0,     cacheCreation: 0 },
  'or:moonshotai/kimi-k2.6':       { input: 0.7448, output: 4.655, cacheRead: 0,     cacheCreation: 0 },
};

const PRESET_MODEL_PRICING: Record<string, Record<string, PricingEntry>> = {
  moonshot: {
    'moonshot-v1-8k':   { input: 0.12,   output: 0.12,   cacheRead: 0, cacheCreation: 0 },
    'moonshot-v1-32k':  { input: 0.24,   output: 0.24,   cacheRead: 0, cacheCreation: 0 },
    'moonshot-v1-128k': { input: 0.81,   output: 0.81,   cacheRead: 0, cacheCreation: 0 },
    'kimi-k2-instruct': { input: 0.7448, output: 4.655,  cacheRead: 0, cacheCreation: 0 },
  },
  qwen: {
    'qwen-plus':         { input: 0.40,  output: 1.20,  cacheRead: 0, cacheCreation: 0 },
    'qwen-turbo':        { input: 0.20,  output: 0.60,  cacheRead: 0, cacheCreation: 0 },
    'qwen-max':          { input: 2.40,  output: 9.60,  cacheRead: 0, cacheCreation: 0 },
    'qwen3-235b-a22b':   { input: 0.325, output: 1.95,  cacheRead: 0, cacheCreation: 0 },
    'qwen3-32b':         { input: 0.20,  output: 0.60,  cacheRead: 0, cacheCreation: 0 },
  },
  minimax: {
    'MiniMax-Text-01':   { input: 0.40,  output: 2.20,  cacheRead: 0,     cacheCreation: 0     },
    'MiniMax-M3':        { input: 0.60,  output: 2.40,  cacheRead: 0.12,  cacheCreation: 0     },
    'minimax-m2':        { input: 0.30,  output: 1.20,  cacheRead: 0.059, cacheCreation: 0     },
    'abab6.5s-chat':     { input: 0.10,  output: 0.10,  cacheRead: 0,     cacheCreation: 0     },
  },
};

const LEGACY_PRICING: PricingTier[] = [
  // Kept for backward-compat with callers using PricingTier directly
  { model: 'whisper-1', inputPer1k: 0, outputPer1k: 0 },
  { model: 'eleven_monolingual_v1', inputPer1k: 0, outputPer1k: 0 },
  { model: 'sonic-english', inputPer1k: 0, outputPer1k: 0 },
];

function lookupEntry(model: string, presetId?: string): PricingEntry | undefined {
  const key = model.toLowerCase();

  if (presetId) {
    const presetTable = PRESET_MODEL_PRICING[presetId];
    if (presetTable) {
      const presetEntry = presetTable[model] ?? presetTable[key];
      if (presetEntry) return presetEntry;
    }
  }

  if (MODEL_PRICING[key]) return MODEL_PRICING[key];

  // keyword fallback for Claude model families
  if (key.includes('opus'))   return MODEL_PRICING['claude-opus-4-8'];
  if (key.includes('haiku'))  return MODEL_PRICING['claude-haiku-4-5-20251001'];
  if (key.includes('sonnet') || key.includes('claude')) return MODEL_PRICING['claude-sonnet-4-6'];

  return undefined;
}

function entryToMoney(entry: PricingEntry, usage: TokenUsage): Money {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const pureInput = usage.inputTokens - cacheRead - cacheWrite;

  const usd =
    (pureInput / 1_000_000) * entry.input +
    (cacheRead / 1_000_000) * entry.cacheRead +
    (cacheWrite / 1_000_000) * entry.cacheCreation +
    (usage.outputTokens / 1_000_000) * entry.output;

  return Money.of(usd);
}

export class PricingCalculator {
  private readonly customTiers: Map<string, PricingTier>;

  constructor(tiers: PricingTier[] = LEGACY_PRICING) {
    this.customTiers = new Map(tiers.map((t) => [t.model, t]));
  }

  cost(model: string, usage: TokenUsage, presetId?: string): Money {
    const entry = lookupEntry(model, presetId);
    if (entry) return entryToMoney(entry, usage);

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
  return lookupEntry(model, presetId) !== undefined;
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
