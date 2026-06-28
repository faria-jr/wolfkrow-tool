import { describe, expect, it } from 'vitest';

import {
  buildProviderFormValues,
  resolveProviderId,
  slugifyProviderId,
} from '../provider-form-helpers';
import type { ProviderFormValues } from '../schema';

const baseValues: ProviderFormValues = {
  displayName: 'My Provider',
  protocol: 'openai-compatible',
  baseUrl: 'https://api.example.com',
  apiKeyAccount: 'my-provider-key',
  models: ['model-1'],
  supportsTools: false,
};

describe('slugifyProviderId', () => {
  it('lowercases, trims dashes and removes special chars', () => {
    expect(slugifyProviderId('  Open AI  ')).toBe('open-ai');
    expect(slugifyProviderId('Z.ai')).toBe('z-ai');
    expect(slugifyProviderId('--MiniMax--')).toBe('minimax');
  });
});

describe('buildProviderFormValues', () => {
  it('starts with empty id in create mode', () => {
    const values = buildProviderFormValues();
    expect(values.id).toBe('');
    expect(values.displayName).toBe('');
  });

  it('merges initial values', () => {
    const values = buildProviderFormValues({ id: 'existing', displayName: 'Existing' });
    expect(values.id).toBe('existing');
    expect(values.displayName).toBe('Existing');
  });
});

describe('resolveProviderId', () => {
  it('slugs displayName when id is empty (create mode)', () => {
    const result = resolveProviderId(baseValues);
    expect(result.id).toBe('my-provider');
  });

  it('keeps explicit id when present (create mode with preset)', () => {
    const result = resolveProviderId({ ...baseValues, id: 'zai' });
    expect(result.id).toBe('zai');
  });

  it('locks id to initialId in edit mode even when displayName changes', () => {
    const editing = { ...baseValues, displayName: 'Renamed Provider' };
    const result = resolveProviderId(editing, 'original');
    expect(result.id).toBe('original');
  });

  it('ignores empty initialId and falls back to slug', () => {
    const result = resolveProviderId(baseValues, '');
    expect(result.id).toBe('my-provider');
  });
});
