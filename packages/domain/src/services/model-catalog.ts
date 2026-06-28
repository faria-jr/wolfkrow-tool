import { ProviderConfig } from '../value-objects/provider-config';

/**
 * P1-5 — Canonical model catalog (single source of truth).
 *
 * This is the ONE place that maps a model id to its provider and per-token
 * pricing. `pricing-calculator`, `claude-compat-presets`, and the worker
 * orchestrator all derive from it — no inline pricing tables, no prefix-guessing.
 *
 * Prices are in USD per million (1_000_000) tokens, matching provider rate
 * cards. A price of 0 is legitimate (e.g. local/cache-unsupported models);
 * an UNKNOWN model returns {@link UNKNOWN_PRICING} (null), never a silent 0.
 */
export interface ModelPricing {
  /** USD per 1M input tokens. */
  readonly inputPerMTok: number;
  /** USD per 1M output tokens. */
  readonly outputPerMTok: number;
  /** USD per 1M cache-read tokens (prompt cache discount). */
  readonly cacheReadPerMTok?: number;
  /** USD per 1M cache-write/creation tokens. */
  readonly cacheCreationPerMTok?: number;
}

export interface ModelCatalogEntry {
  /** Model id as used in API requests (e.g. "claude-sonnet-4-6"). */
  readonly model: string;
  /** Owning provider id. */
  readonly providerId: string;
  /** Per-token pricing in USD per million tokens. */
  readonly pricing: ModelPricing;
}

/** Sentinel for "price is unknown" — distinct from a legitimate $0 price. */
export const UNKNOWN_PRICING: null = null;

const MODEL_CATALOG_DATA: readonly ModelCatalogEntry[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    model: 'claude-opus-4-8',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 5.0,
      outputPerMTok: 25.0,
      cacheReadPerMTok: 0.5,
      cacheCreationPerMTok: 6.25,
    },
  },
  {
    model: 'claude-opus-4-7',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 5.0,
      outputPerMTok: 25.0,
      cacheReadPerMTok: 0.5,
      cacheCreationPerMTok: 6.25,
    },
  },
  {
    model: 'claude-opus-4-6',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 5.0,
      outputPerMTok: 25.0,
      cacheReadPerMTok: 0.5,
      cacheCreationPerMTok: 6.25,
    },
  },
  {
    model: 'claude-sonnet-4-6',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      cacheReadPerMTok: 0.3,
      cacheCreationPerMTok: 3.75,
    },
  },
  {
    model: 'claude-haiku-4-5-20251001',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 1.0,
      outputPerMTok: 5.0,
      cacheReadPerMTok: 0.1,
      cacheCreationPerMTok: 1.25,
    },
  },
  {
    model: 'claude-sonnet-4-5-20250514',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      cacheReadPerMTok: 0.3,
      cacheCreationPerMTok: 3.75,
    },
  },
  {
    model: 'claude-haiku-3-5-20241022',
    providerId: 'anthropic',
    pricing: {
      inputPerMTok: 0.8,
      outputPerMTok: 4.0,
      cacheReadPerMTok: 0.08,
      cacheCreationPerMTok: 1.0,
    },
  },
  // ── OpenAI ───────────────────────────────────────────────────────────────
  {
    model: 'gpt-4o',
    providerId: 'openai',
    pricing: { inputPerMTok: 5.0, outputPerMTok: 15.0, cacheReadPerMTok: 0.5 },
  },
  {
    model: 'gpt-4.1',
    providerId: 'openai',
    pricing: { inputPerMTok: 5.0, outputPerMTok: 15.0, cacheReadPerMTok: 0.5 },
  },
  {
    model: 'gpt-4o-mini',
    providerId: 'openai',
    pricing: { inputPerMTok: 0.15, outputPerMTok: 0.6, cacheReadPerMTok: 0.015 },
  },
  {
    model: 'o3',
    providerId: 'openai',
    pricing: { inputPerMTok: 10.0, outputPerMTok: 40.0, cacheReadPerMTok: 1.0 },
  },
  // ── Z.ai (GLM) ───────────────────────────────────────────────────────────
  { model: 'glm-4.7', providerId: 'zai', pricing: { inputPerMTok: 0.38, outputPerMTok: 1.74 } },
  { model: 'glm-4.5-air', providerId: 'zai', pricing: { inputPerMTok: 0.14, outputPerMTok: 0.56 } },
  { model: 'glm-5.1', providerId: 'zai', pricing: { inputPerMTok: 1.0, outputPerMTok: 4.0 } },
  { model: 'glm-5-turbo', providerId: 'zai', pricing: { inputPerMTok: 0.5, outputPerMTok: 2.0 } },
  // ── MiniMax ──────────────────────────────────────────────────────────────
  // Registry authority: PascalCase MiniMax-* ids. Pricing lookup is
  // case-insensitive, so legacy lowercase (minimax-m2.7) also resolves.
  {
    model: 'MiniMax-M2.7',
    providerId: 'minimax',
    pricing: {
      inputPerMTok: 0.3,
      outputPerMTok: 1.2,
      cacheReadPerMTok: 0.06,
      cacheCreationPerMTok: 0.375,
    },
  },
  {
    model: 'MiniMax-M2.7-highspeed',
    providerId: 'minimax',
    pricing: {
      inputPerMTok: 0.3,
      outputPerMTok: 1.2,
      cacheReadPerMTok: 0.06,
      cacheCreationPerMTok: 0.375,
    },
  },
  {
    model: 'MiniMax-M2.5',
    providerId: 'minimax',
    pricing: {
      inputPerMTok: 0.3,
      outputPerMTok: 1.2,
      cacheReadPerMTok: 0.03,
      cacheCreationPerMTok: 0.375,
    },
  },
  {
    model: 'MiniMax-M2.5-highspeed',
    providerId: 'minimax',
    pricing: {
      inputPerMTok: 0.3,
      outputPerMTok: 1.2,
      cacheReadPerMTok: 0.03,
      cacheCreationPerMTok: 0.375,
    },
  },
  {
    model: 'MiniMax-M3',
    providerId: 'minimax',
    pricing: {
      inputPerMTok: 0.6,
      outputPerMTok: 2.4,
      cacheReadPerMTok: 0.12,
      cacheCreationPerMTok: 0.375,
    },
  },
  {
    model: 'MiniMax-Text-01',
    providerId: 'minimax',
    pricing: { inputPerMTok: 0.4, outputPerMTok: 2.2 },
  },
  // ── Qwen (DashScope) ─────────────────────────────────────────────────────
  { model: 'qwen-max', providerId: 'qwen', pricing: { inputPerMTok: 2.4, outputPerMTok: 9.6 } },
  { model: 'qwen-plus', providerId: 'qwen', pricing: { inputPerMTok: 0.4, outputPerMTok: 1.2 } },
  { model: 'qwen-turbo', providerId: 'qwen', pricing: { inputPerMTok: 0.2, outputPerMTok: 0.6 } },
  {
    model: 'qwen-coder-plus',
    providerId: 'qwen',
    pricing: { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  },
  { model: 'qwen3-max', providerId: 'qwen', pricing: { inputPerMTok: 0.4, outputPerMTok: 1.2 } },
  {
    model: 'qwen3-coder-plus',
    providerId: 'qwen',
    pricing: { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  },
  {
    model: 'qwen3-235b-a22b',
    providerId: 'qwen',
    pricing: { inputPerMTok: 0.325, outputPerMTok: 1.95 },
  },
  { model: 'qwen3-32b', providerId: 'qwen', pricing: { inputPerMTok: 0.2, outputPerMTok: 0.6 } },
  // ── Moonshot (Kimi) ──────────────────────────────────────────────────────
  {
    model: 'kimi-k2',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.7448, outputPerMTok: 4.655 },
  },
  {
    model: 'kimi-k2-0711',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.7448, outputPerMTok: 4.655 },
  },
  {
    model: 'kimi-k1.5',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.7448, outputPerMTok: 4.655 },
  },
  {
    model: 'kimi-k2.6',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.95, outputPerMTok: 4.0, cacheReadPerMTok: 0.16 },
  },
  {
    model: 'kimi-k2-instruct',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.7448, outputPerMTok: 4.655 },
  },
  {
    model: 'moonshot-v1-8k',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.12, outputPerMTok: 0.12 },
  },
  {
    model: 'moonshot-v1-32k',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.24, outputPerMTok: 0.24 },
  },
  {
    model: 'moonshot-v1-128k',
    providerId: 'moonshot',
    pricing: { inputPerMTok: 0.81, outputPerMTok: 0.81 },
  },
  // ── OpenRouter (prefixed) ────────────────────────────────────────────────
  {
    model: 'or:deepseek/deepseek-v4-pro',
    providerId: 'openrouter',
    pricing: { inputPerMTok: 0.435, outputPerMTok: 0.87, cacheReadPerMTok: 0.1 },
  },
  {
    model: 'or:z-ai/glm-4.7',
    providerId: 'openrouter',
    pricing: { inputPerMTok: 0.38, outputPerMTok: 1.74 },
  },
  {
    model: 'or:moonshotai/kimi-k2.6',
    providerId: 'openrouter',
    pricing: { inputPerMTok: 0.7448, outputPerMTok: 4.655 },
  },
];

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = MODEL_CATALOG_DATA;

const MODEL_INDEX: ReadonlyMap<string, ModelCatalogEntry> = new Map(
  MODEL_CATALOG_DATA.map((e) => [e.model.toLowerCase(), e])
);

/**
 * Look up a catalog entry by model id (case-insensitive exact match).
 * Returns `undefined` when the model is not registered.
 */
export function lookupModel(model: string): ModelCatalogEntry | undefined {
  return MODEL_INDEX.get(model.toLowerCase());
}

/**
 * Resolve a model's pricing. When `providerId` is given, only a model
 * registered under that provider matches. Returns `undefined` for unknown
 * models; callers MUST NOT treat an absent price as a silent $0.
 */
export function lookupModelPricing(model: string, providerId?: string): ModelPricing | undefined {
  const entry = lookupModel(model);
  if (!entry) return undefined;
  if (providerId && entry.providerId !== providerId) return undefined;
  return entry.pricing;
}

/**
 * Resolve the provider id for a model from the catalog (no prefix guessing).
 * Returns `undefined` for models not in the catalog — callers fall back to
 * prefix inference only for those.
 */
export function getProviderForModel(model: string): string | undefined {
  return lookupModel(model)?.providerId;
}

/** All model ids registered under a provider (empty for unknown providers). */
export function getModelsByProvider(providerId: string): readonly string[] {
  return MODEL_CATALOG_DATA.filter((e) => e.providerId === providerId).map((e) => e.model);
}

// Re-export ProviderConfig so this file remains self-contained for catalog data.
export { ProviderConfig };
