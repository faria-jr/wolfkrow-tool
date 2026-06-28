import { describe, expect, it } from 'vitest';

import {
  ChannelPairingSchema,
  ChannelSchema,
  ChannelStatusSchema,
  ChannelTypeSchema,
  CreateChannelInputSchema,
  UpdateChannelInputSchema,
} from '../schemas/channels';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('channels schemas', () => {
  describe('ChannelTypeSchema', () => {
    it.each(['telegram', 'discord', 'slack', 'whatsapp'] as const)('accepts %s', (v) => {
      expect(ChannelTypeSchema.parse(v)).toBe(v);
    });
    it('rejects invalid', () => {
      expect(() => ChannelTypeSchema.parse('nope')).toThrow();
    });
  });

  describe('ChannelStatusSchema', () => {
    it.each(['connected', 'disconnected', 'error', 'pairing'] as const)('accepts %s', (v) => {
      expect(ChannelStatusSchema.parse(v)).toBe(v);
    });
    it('rejects invalid', () => {
      expect(() => ChannelStatusSchema.parse('nope')).toThrow();
    });
  });

  describe('ChannelSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      type: 'telegram' as const,
      name: 'My channel',
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };

    it('accepts a valid channel and applies defaults', () => {
      expect(ChannelSchema.parse(valid)).toEqual({
        ...valid,
        enabled: false,
        status: 'disconnected',
        config: {},
        createdAt: new Date(ts),
        updatedAt: new Date(ts),
      });
    });

    it('rejects missing name', () => {
      const { name: _omit, ...rest } = valid;
      expect(() => ChannelSchema.parse(rest)).toThrow();
    });

    it('rejects invalid type', () => {
      expect(() => ChannelSchema.parse({ ...valid, type: 'nope' })).toThrow();
    });

    it('rejects non-uuid id', () => {
      expect(() => ChannelSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });

  describe('CreateChannelInputSchema', () => {
    it('accepts the input subset and applies defaults', () => {
      const input = { type: 'slack' as const, name: 'Slack', enabled: true };
      const parsed = CreateChannelInputSchema.parse(input);
      expect(parsed.config).toEqual({});
      expect(parsed.metadata).toEqual({});
      expect(parsed.enabled).toBe(true);
    });
    it('rejects missing name', () => {
      expect(() => CreateChannelInputSchema.parse({ type: 'slack' })).toThrow();
    });
  });

  describe('UpdateChannelInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateChannelInputSchema.parse({})).toEqual({});
    });
    it('rejects bad type when provided', () => {
      expect(() => UpdateChannelInputSchema.parse({ type: 'nope' })).toThrow();
    });
  });

  describe('ChannelPairingSchema', () => {
    const valid = {
      id: uuid,
      channelType: 'telegram' as const,
      code: '123456',
      expiresAt: ts,
      createdAt: ts,
    };
    it('accepts a valid pairing', () => {
      expect(() => ChannelPairingSchema.parse(valid)).not.toThrow();
    });
    it('rejects a code with wrong length', () => {
      expect(() => ChannelPairingSchema.parse({ ...valid, code: '12345' })).toThrow();
    });
    it('rejects missing channelType', () => {
      const { channelType: _omit, ...rest } = valid;
      expect(() => ChannelPairingSchema.parse(rest)).toThrow();
    });
  });
});
