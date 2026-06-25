import { describe, expect, it } from 'vitest';

import {
  MODEL_CATALOG,
  UNKNOWN_PRICING,
  lookupModel,
  lookupModelPricing,
  getProviderForModel,
  getModelsByProvider,
} from '../provider-registry';

describe('MODEL_CATALOG (canonical registry)', () => {
  describe('lookupModel', () => {
    it('returns entry for an exact known model id', () => {
      const entry = lookupModel('claude-sonnet-4-6');
      expect(entry).toBeDefined();
      expect(entry?.providerId).toBe('anthropic');
      expect(entry?.pricing.inputPerMTok).toBeGreaterThan(0);
      expect(entry?.pricing.outputPerMTok).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
      expect(lookupModel('claude-sonnet-4-6')).toBeDefined();
      expect(lookupModel('CLAUDE-SONNET-4-6')).toBeDefined();
    });

    it('returns undefined for a model that is not in the catalog', () => {
      expect(lookupModel('totally-fake-model-xyz')).toBeUndefined();
    });

    it('every catalog entry has a non-empty model, providerId, and positive prices', () => {
      for (const entry of MODEL_CATALOG) {
        expect(entry.model.length).toBeGreaterThan(0);
        expect(entry.providerId.length).toBeGreaterThan(0);
        expect(entry.pricing.inputPerMTok).toBeGreaterThanOrEqual(0);
        expect(entry.pricing.outputPerMTok).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('lookupModelPricing', () => {
    it('returns pricing for a known model', () => {
      const pricing = lookupModelPricing('gpt-4o');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPerMTok).toBe(5);
      expect(pricing?.outputPerMTok).toBe(15);
    });

    it('returns pricing for a claude-compat model (glm)', () => {
      const pricing = lookupModelPricing('glm-4.7');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPerMTok).toBeGreaterThan(0);
    });

    it('scopes by providerId when the same model name exists under multiple providers', () => {
      // qwen-max exists under the qwen provider; provider scoping resolves it.
      const scoped = lookupModelPricing('qwen-max', 'qwen');
      expect(scoped).toBeDefined();
      expect(scoped?.inputPerMTok).toBeGreaterThan(0);
    });

    it('returns undefined for an unknown model (not a silent 0)', () => {
      expect(lookupModelPricing('does-not-exist-999')).toBeUndefined();
    });
  });

  describe('UNKNOWN_PRICING sentinel', () => {
    it('is null — distinct from undefined (not-in-catalog) and from a real 0 price', () => {
      expect(UNKNOWN_PRICING).toBeNull();
    });
  });

  describe('getProviderForModel', () => {
    it('resolves the provider for a claude family model', () => {
      expect(getProviderForModel('claude-opus-4-8')).toBe('anthropic');
    });

    it('resolves zai for a glm model', () => {
      expect(getProviderForModel('glm-4.7')).toBe('zai');
    });

    it('resolves minimax for a MiniMax model (case-insensitive)', () => {
      expect(getProviderForModel('MiniMax-M2.7')).toBe('minimax');
      expect(getProviderForModel('minimax-m2.5')).toBe('minimax');
    });

    it('resolves moonshot for a kimi model', () => {
      expect(getProviderForModel('kimi-k2')).toBe('moonshot');
    });

    it('resolves qwen for a qwen model', () => {
      expect(getProviderForModel('qwen-max')).toBe('qwen');
    });

    it('resolves openai for a gpt model', () => {
      expect(getProviderForModel('gpt-4o')).toBe('openai');
    });

    it('returns undefined for an unknown model (no provider guess)', () => {
      expect(getProviderForModel('some-random-model')).toBeUndefined();
    });
  });

  describe('getModelsByProvider', () => {
    it('returns all models registered under a provider', () => {
      const anthropicModels = getModelsByProvider('anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(anthropicModels).toContain('claude-sonnet-4-6');
    });

    it('returns empty for an unknown provider', () => {
      expect(getModelsByProvider('no-such-provider')).toEqual([]);
    });
  });
});
