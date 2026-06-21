import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/domain-error';

describe('DomainError', () => {
  it('carries code, message and context', () => {
    const err = new DomainError('CUSTOM', 'boom', { foo: 1 });
    expect(err.code).toBe('CUSTOM');
    expect(err.message).toBe('boom');
    expect(err.context).toEqual({ foo: 1 });
    expect(err).toBeInstanceOf(Error);
  });

  it('defaults context to empty object', () => {
    expect(new DomainError('X', 'm').context).toEqual({});
  });
});

describe('NotFoundError', () => {
  it('builds message from resource + id', () => {
    const err = new NotFoundError('User', 'abc');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('User');
    expect(err.message).toContain('abc');
    expect(err.name).toBe('NotFoundError');
    expect(err.context).toEqual({ resource: 'User', id: 'abc' });
  });
});

describe('BusinessRuleError', () => {
  it('records rule and merges context', () => {
    const err = new BusinessRuleError('unique-email', 'email taken', { email: 'a@b' });
    expect(err.code).toBe('BUSINESS_RULE');
    expect(err.context).toMatchObject({ rule: 'unique-email', email: 'a@b' });
  });
});

describe('ConflictError', () => {
  it('uses CONFLICT code', () => {
    expect(new ConflictError('dup').code).toBe('CONFLICT');
  });
});

describe('UnauthorizedError', () => {
  it('defaults message', () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });
});

describe('ForbiddenError', () => {
  it('defaults message', () => {
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
  });
});

describe('ValidationError', () => {
  it('stores field', () => {
    const err = new ValidationError('email', 'invalid');
    expect(err.field).toBe('email');
    expect(err.code).toBe('VALIDATION');
  });

  it('fromZod aggregates issues into message', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'bad' });
    if (!result.success) {
      const err = ValidationError.fromZod('email', result.error);
      expect(err.field).toBe('email');
      expect(err.message).toContain('email');
      expect(err.context).toHaveProperty('zodIssues');
    } else {
      expect.unreachable('should have failed');
    }
  });
});
