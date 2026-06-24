import { describe, expect, it } from 'vitest';

import { LoginResponseSchema } from '../schemas/auth';

describe('LoginResponseSchema', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  describe('success variant', () => {
    it('accepts a valid success payload with userId', () => {
      const payload = { status: 'success', userId: uuid };
      expect(LoginResponseSchema.parse(payload)).toEqual(payload);
    });

    it('rejects success without userId', () => {
      expect(() => LoginResponseSchema.parse({ status: 'success' })).toThrow();
    });
  });

  describe('requires_totp variant', () => {
    it('accepts a valid requires_totp payload with userId', () => {
      const payload = { status: 'requires_totp', userId: uuid };
      expect(LoginResponseSchema.parse(payload)).toEqual(payload);
    });

    it('rejects requires_totp without userId', () => {
      expect(() =>
        LoginResponseSchema.parse({ status: 'requires_totp' }),
      ).toThrow();
    });

    it('rejects requires_totp with a non-UUID userId', () => {
      expect(() =>
        LoginResponseSchema.parse({ status: 'requires_totp', userId: 'not-a-uuid' }),
      ).toThrow();
    });
  });

  describe('locked variant', () => {
    it('accepts a valid locked payload with lockedUntil', () => {
      const payload = { status: 'locked', lockedUntil: '2099-01-01T12:00:00Z' };
      expect(LoginResponseSchema.parse(payload)).toEqual({
        status: 'locked',
        lockedUntil: new Date('2099-01-01T12:00:00Z'),
      });
    });

    it('rejects locked without lockedUntil', () => {
      expect(() => LoginResponseSchema.parse({ status: 'locked' })).toThrow();
    });
  });

  describe('discrimination', () => {
    it('rejects an unknown status', () => {
      expect(() =>
        LoginResponseSchema.parse({ status: 'unknown', userId: uuid }),
      ).toThrow();
    });

    it('rejects a completely invalid payload', () => {
      expect(() => LoginResponseSchema.parse(null)).toThrow();
      expect(() => LoginResponseSchema.parse({})).toThrow();
    });
  });
});
