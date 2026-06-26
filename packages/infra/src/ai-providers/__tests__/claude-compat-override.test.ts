/**
 * Tests: EPIC 4.3 — ClaudeCompatProvider end-to-end baseURL/apiKey override.
 *
 * Constructs the provider for each anthropic-compat preset (glm/kimi/minimax/
 * qwen) and asserts the underlying Anthropic SDK client is built with that
 * preset's canonical base URL + the supplied api key (regression: a request
 * for a GLM/Kimi/MiniMax/Qwen model routes to the correct endpoint+auth).
 * No code change — pure contract assertion.
 */

import { describe, expect, it, vi } from 'vitest';

import { ClaudeCompatProvider } from '../claude-compat';

const { ctorConfigs } = vi.hoisted(() => ({ ctorConfigs: [] as Array<{ apiKey?: string; baseURL?: string }> }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor(config: { apiKey?: string; baseURL?: string }) {
      ctorConfigs.push(config);
    }
  },
}));

describe('EPIC 4.3 — provider threads preset baseURL + apiKey to the SDK', () => {
  it('builds the Anthropic client with each preset canonical endpoint + key', () => {
    ctorConfigs.length = 0;
    new ClaudeCompatProvider('key-zai', 'zai');
    new ClaudeCompatProvider('key-minimax', 'minimax');
    new ClaudeCompatProvider('key-moonshot', 'moonshot');
    new ClaudeCompatProvider('key-qwen', 'qwen');

    expect(ctorConfigs).toContainEqual({ apiKey: 'key-zai', baseURL: 'https://api.z.ai/api/anthropic' });
    expect(ctorConfigs).toContainEqual({ apiKey: 'key-minimax', baseURL: 'https://api.minimax.io/anthropic' });
    expect(ctorConfigs).toContainEqual({ apiKey: 'key-moonshot', baseURL: 'https://api.moonshot.cn/anthropic' });
    expect(ctorConfigs).toContainEqual({ apiKey: 'key-qwen', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/anthropic' });
  });

  it('also accepts an explicit baseUrl override (custom provider)', () => {
    ctorConfigs.length = 0;
    new ClaudeCompatProvider('custom-key', { baseUrl: 'https://custom.example/anthropic' });
    expect(ctorConfigs).toContainEqual({ apiKey: 'custom-key', baseURL: 'https://custom.example/anthropic' });
  });
});
