import { describe, expect, it } from 'vitest';

import {
  SecretCategorySchema,
  SecretMetadataSchema,
  StoreSecretInputSchema,
  UpdateSecretInputSchema,
} from '../schemas/vault';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('vault schemas', () => {
  describe('SecretCategorySchema', () => {
    it.each(['ai', 'integration', 'oauth', 'other'] as const)('accepts %s', (v) => {
      expect(SecretCategorySchema.parse(v)).toBe(v);
    });
    it('rejects invalid category', () => {
      expect(() => SecretCategorySchema.parse('nope')).toThrow();
    });
  });

  describe('SecretMetadataSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      key: 'OPENAI_API_KEY',
      displayName: 'OpenAI',
      category: 'ai' as const,
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };

    it('accepts a valid secret metadata payload', () => {
      expect(SecretMetadataSchema.parse(valid)).toEqual({
        ...valid,
        createdAt: new Date(ts),
        updatedAt: new Date(ts),
      });
    });
    it('accepts optional description / lastAccessed / lastRotated', () => {
      const withOpts = {
        ...valid,
        description: 'a secret',
        lastAccessed: ts,
        lastRotated: ts,
      };
      expect(() => SecretMetadataSchema.parse(withOpts)).not.toThrow();
    });
    it('rejects missing key', () => {
      const { key: _omit, ...rest } = valid;
      expect(() => SecretMetadataSchema.parse(rest)).toThrow();
    });
    it('rejects bad category', () => {
      expect(() => SecretMetadataSchema.parse({ ...valid, category: 'nope' })).toThrow();
    });
    it('rejects non-uuid id', () => {
      expect(() => SecretMetadataSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });

  describe('StoreSecretInputSchema', () => {
    const valid = {
      key: 'KEY',
      displayName: 'Display',
      value: 'secret-value',
      category: 'ai' as const,
    };
    it('accepts valid input and applies default metadata', () => {
      expect(StoreSecretInputSchema.parse(valid)).toEqual({ ...valid, metadata: {} });
    });
    it('rejects empty value', () => {
      expect(() => StoreSecretInputSchema.parse({ ...valid, value: '' })).toThrow();
    });
    it('rejects missing displayName', () => {
      const { displayName: _omit, ...rest } = valid;
      expect(() => StoreSecretInputSchema.parse(rest)).toThrow();
    });
  });

  describe('UpdateSecretInputSchema', () => {
    it('accepts an empty object (all fields optional)', () => {
      expect(UpdateSecretInputSchema.parse({})).toEqual({});
    });
    it('accepts partial update', () => {
      expect(UpdateSecretInputSchema.parse({ displayName: 'New' })).toEqual({
        displayName: 'New',
      });
    });
    it('rejects empty value (NonEmptyString still enforced when present)', () => {
      expect(() => UpdateSecretInputSchema.parse({ value: '' })).toThrow();
    });
    it('rejects bad category', () => {
      expect(() => UpdateSecretInputSchema.parse({ category: 'nope' })).toThrow();
    });
  });
});
