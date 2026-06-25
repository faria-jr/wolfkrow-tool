import { describe, expect, it } from 'vitest';

import { BUILT_IN_PROVIDERS, getProviderById } from '../provider-registry';
import {
  CLAUDE_COMPAT_PRESETS,
  CLAUDE_COMPAT_PROVIDER_IDS,
  getClaudeCompatPreset,
  isClaudeCompatProviderId,
} from '../claude-compat-presets';

describe('claude-compat-presets', () => {
  it('contains four providers', () => {
    expect(CLAUDE_COMPAT_PROVIDER_IDS).toEqual(['zai', 'minimax', 'moonshot', 'qwen']);
  });

  it('presets are derived from the canonical provider-registry (DRY: single source)', () => {
    // Every claude-compat preset must match the corresponding built-in provider
    // config — no divergent copies of baseUrl/apiKeyAccount/displayName/models.
    for (const id of CLAUDE_COMPAT_PROVIDER_IDS) {
      const provider = getProviderById(BUILT_IN_PROVIDERS, id);
      expect(provider, `provider ${id} should exist in registry`).toBeDefined();
      const preset = CLAUDE_COMPAT_PRESETS[id];
      expect(preset.displayName).toBe(provider!.displayName);
      expect(preset.baseUrl).toBe(provider!.baseUrl);
      expect(preset.apiKeyAccount).toBe(provider!.apiKeyAccount);
      expect(preset.models).toEqual(provider!.models);
    }
  });

  it('zai preset has expected baseUrl, account and models', () => {
    const preset = CLAUDE_COMPAT_PRESETS.zai;
    expect(preset.displayName).toBe('Z.ai (GLM)');
    expect(preset.baseUrl).toBe('https://api.z.ai/api/anthropic');
    expect(preset.apiKeyAccount).toBe('zai-api-key');
    expect(preset.models).toContain('glm-4.7');
    expect(preset.models).toContain('glm-5-turbo');
  });

  it('minimax preset includes highspeed variants', () => {
    const preset = CLAUDE_COMPAT_PRESETS.minimax;
    expect(preset.baseUrl).toBe('https://api.minimax.io/anthropic');
    expect(preset.apiKeyAccount).toBe('minimax-api-key');
    expect(preset.models).toContain('MiniMax-M2.7-highspeed');
    expect(preset.models).toContain('MiniMax-M3');
  });

  it('moonshot preset points to anthropic-compatible endpoint', () => {
    const preset = CLAUDE_COMPAT_PRESETS.moonshot;
    expect(preset.baseUrl).toContain('moonshot.cn');
    expect(preset.baseUrl).toContain('anthropic');
    expect(preset.apiKeyAccount).toBe('moonshot-api-key');
  });

  it('qwen preset points to dashscope compatible-mode', () => {
    const preset = CLAUDE_COMPAT_PRESETS.qwen;
    expect(preset.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/anthropic');
    expect(preset.apiKeyAccount).toBe('qwen-api-key');
    expect(preset.models).toContain('qwen-max');
  });

  describe('getClaudeCompatPreset', () => {
    it('returns preset for known provider', () => {
      expect(getClaudeCompatPreset('zai').id).toBe('zai');
      expect(getClaudeCompatPreset('qwen').id).toBe('qwen');
    });

    it('throws for unknown provider', () => {
      expect(() => getClaudeCompatPreset('unknown')).toThrow('Unknown Claude-compat provider: unknown');
    });
  });

  describe('isClaudeCompatProviderId', () => {
    it('returns true for known ids', () => {
      expect(isClaudeCompatProviderId('minimax')).toBe(true);
      expect(isClaudeCompatProviderId('moonshot')).toBe(true);
    });

    it('returns false for arbitrary strings', () => {
      expect(isClaudeCompatProviderId('openrouter')).toBe(false);
      expect(isClaudeCompatProviderId('')).toBe(false);
    });
  });
});
