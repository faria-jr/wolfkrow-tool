import { describe, expect, it } from 'vitest';

import {
  LoginInputSchema,
  LoginResponseSchema,
  SetupPasswordInputSchema,
  SetupRequestBodySchema,
  TotpInputSchema,
} from '../schemas/auth';

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
      expect(() => LoginResponseSchema.parse({ status: 'requires_totp' })).toThrow();
    });

    it('rejects requires_totp with a non-UUID userId', () => {
      expect(() =>
        LoginResponseSchema.parse({ status: 'requires_totp', userId: 'not-a-uuid' })
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
      expect(() => LoginResponseSchema.parse({ status: 'unknown', userId: uuid })).toThrow();
    });

    it('rejects a completely invalid payload', () => {
      expect(() => LoginResponseSchema.parse(null)).toThrow();
      expect(() => LoginResponseSchema.parse({})).toThrow();
    });
  });
});

describe('SetupPasswordInputSchema (refine: password match)', () => {
  it('accepts when password and confirmPassword match', () => {
    const payload = { password: 'secret123', confirmPassword: 'secret123' };
    expect(() => SetupPasswordInputSchema.parse(payload)).not.toThrow();
  });
  it('rejects when passwords do not match', () => {
    expect(() =>
      SetupPasswordInputSchema.parse({ password: 'secret123', confirmPassword: 'nope' })
    ).toThrow();
  });
  it('rejects password without a letter', () => {
    expect(() =>
      SetupPasswordInputSchema.parse({ password: '12345678', confirmPassword: '12345678' })
    ).toThrow();
  });
  it('rejects password without a number', () => {
    expect(() =>
      SetupPasswordInputSchema.parse({ password: 'abcdefgh', confirmPassword: 'abcdefgh' })
    ).toThrow();
  });
  it('rejects password under 8 chars', () => {
    expect(() =>
      SetupPasswordInputSchema.parse({ password: 'ab1', confirmPassword: 'ab1' })
    ).toThrow();
  });
});

describe('SetupRequestBodySchema (refine: optional confirmPassword)', () => {
  it('accepts when confirmPassword omitted', () => {
    expect(() => SetupRequestBodySchema.parse({ password: 'secret123' })).not.toThrow();
  });
  it('accepts when confirmPassword matches', () => {
    expect(() =>
      SetupRequestBodySchema.parse({
        password: 'secret123',
        confirmPassword: 'secret123',
      })
    ).not.toThrow();
  });
  it('rejects when confirmPassword is present but does not match', () => {
    expect(() =>
      SetupRequestBodySchema.parse({
        password: 'secret123',
        confirmPassword: 'mismatch1',
      })
    ).toThrow();
  });
});

describe('LoginInputSchema', () => {
  it('accepts a non-empty password', () => {
    expect(LoginInputSchema.parse({ password: 'x' })).toEqual({ password: 'x' });
  });
  it('rejects empty password', () => {
    expect(() => LoginInputSchema.parse({ password: '' })).toThrow();
  });
});

describe('TotpInputSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(TotpInputSchema.parse({ code: '123456' })).toEqual({ code: '123456' });
  });
  it('rejects a non-6-digit code', () => {
    expect(() => TotpInputSchema.parse({ code: '12345' })).toThrow();
    expect(() => TotpInputSchema.parse({ code: 'abcdef' })).toThrow();
  });
});
