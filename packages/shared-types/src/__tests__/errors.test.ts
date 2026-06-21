import { describe, expect, it } from 'vitest';

import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  DomainError,
  AgentNotFoundError,
  AccountLockedError,
  TOTPRequiredError,
  PermissionDeniedError,
  serializeError,
} from '../errors';

describe('DomainError', () => {
  it('preserves name, message and metadata', () => {
    const err = new ValidationError('bad input', { field: 'email' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.message).toBe('bad input');
    expect(err.metadata).toEqual({ field: 'email' });
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });
});

describe('NotFoundError', () => {
  it('formats message with resource name', () => {
    const err = new NotFoundError('Agent');
    expect(err.message).toBe('Agent not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('formats message with id', () => {
    const err = new NotFoundError('Agent', 'abc-123');
    expect(err.message).toBe('Agent not found: abc-123');
  });
});

describe('AgentNotFoundError', () => {
  it('is a NotFoundError with agent context', () => {
    const err = new AgentNotFoundError('agent-1');
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Agent not found: agent-1');
  });
});

describe('UnauthorizedError', () => {
  it('has default message', () => {
    expect(new UnauthorizedError().message).toBe('Unauthorized');
    expect(new UnauthorizedError('Custom').message).toBe('Custom');
  });
});

describe('AccountLockedError', () => {
  it('includes lockedUntil metadata', () => {
    const lockedUntil = new Date('2026-12-31');
    const err = new AccountLockedError(lockedUntil);
    expect(err.code).toBe('ACCOUNT_LOCKED');
    expect(err.statusCode).toBe(423);
    expect(err.metadata.lockedUntil).toEqual(lockedUntil);
  });
});

describe('TOTPRequiredError', () => {
  it('has correct code and status', () => {
    const err = new TOTPRequiredError();
    expect(err.code).toBe('TOTP_REQUIRED');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('TOTP_REQUIRED');
  });
});

describe('PermissionDeniedError', () => {
  it('includes tool and reason metadata', () => {
    const err = new PermissionDeniedError('Bash', 'destructive command');
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.statusCode).toBe(403);
    expect(err.metadata).toEqual({ tool: 'Bash', reason: 'destructive command' });
  });
});

describe('serializeError', () => {
  it('serializes DomainError', () => {
    const err = new ValidationError('test');
    const serialized = serializeError(err);
    expect(serialized.code).toBe('VALIDATION_ERROR');
    expect(serialized.statusCode).toBe(400);
    expect(serialized.message).toBe('test');
  });

  it('serializes generic Error', () => {
    const err = new Error('oops');
    const serialized = serializeError(err);
    expect(serialized.code).toBe('UNKNOWN_ERROR');
    expect(serialized.statusCode).toBe(500);
  });

  it('serializes unknown value', () => {
    const serialized = serializeError('string error');
    expect(serialized.code).toBe('UNKNOWN_ERROR');
    expect(serialized.message).toBe('string error');
  });
});
