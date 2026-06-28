import { describe, expect, it } from 'vitest';

import { DEFAULT_AGENT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_CODER_MODEL } from '../constants/models';

describe('default model constants', () => {
  it('exposes a DEFAULT_CHAT_MODEL string', () => {
    expect(typeof DEFAULT_CHAT_MODEL).toBe('string');
    expect(DEFAULT_CHAT_MODEL.length).toBeGreaterThan(0);
  });
  it('exposes a DEFAULT_CODER_MODEL string', () => {
    expect(typeof DEFAULT_CODER_MODEL).toBe('string');
    expect(DEFAULT_CODER_MODEL.length).toBeGreaterThan(0);
  });
  it('exposes a DEFAULT_AGENT_MODEL string', () => {
    expect(typeof DEFAULT_AGENT_MODEL).toBe('string');
    expect(DEFAULT_AGENT_MODEL.length).toBeGreaterThan(0);
  });
});
