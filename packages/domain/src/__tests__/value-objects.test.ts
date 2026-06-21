import { describe, expect, it } from 'vitest';

import {
  CronExpression,
  Email,
  EmbeddingVector,
  Id,
  ModelId,
  PasswordHash,
  PlainPassword,
  Timestamp,
  ToolName,
  ValidationError,
} from '../index';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Id', () => {
  it('creates from valid uuid', () => {
    expect(Id.create(UUID).value).toBe(UUID);
  });
  it('rejects non-uuid', () => {
    expect(() => Id.create('nope')).toThrow(ValidationError);
  });
  it('generate produces a uuid', () => {
    expect(Id.generate().value).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('equals by value', () => {
    expect(Id.create(UUID).equals(Id.create(UUID))).toBe(true);
    expect(Id.create(UUID).equals(Id.generate())).toBe(false);
  });
});

describe('Email', () => {
  it('normalizes to lowercase/trim', () => {
    expect(Email.create('  Foo@Bar.COM  ').value).toBe('foo@bar.com');
  });
  it('rejects invalid', () => {
    expect(() => Email.create('not-email')).toThrow(ValidationError);
  });
});

describe('Timestamp', () => {
  it('now returns parseable ISO', () => {
    const ts = Timestamp.now();
    expect(new Date(ts.value).toString()).not.toBe('Invalid Date');
    expect(ts.toDate()).toBeInstanceOf(Date);
  });
  it('create validates ISO datetime', () => {
    expect(Timestamp.create('2026-06-20T10:00:00Z').value).toBe('2026-06-20T10:00:00Z');
    expect(() => Timestamp.create('20/06/2026')).toThrow(ValidationError);
  });
});

describe('ModelId', () => {
  it('accepts provider/model shapes', () => {
    expect(ModelId.create('claude-sonnet-4-6').value).toBe('claude-sonnet-4-6');
    expect(ModelId.create('accounts/fw/models/llama').value).toBe('accounts/fw/models/llama');
  });
  it('rejects spaces/empty', () => {
    expect(() => ModelId.create('bad model')).toThrow(ValidationError);
    expect(() => ModelId.create('')).toThrow(ValidationError);
  });
});

describe('ToolName', () => {
  it('accepts plain and namespaced', () => {
    expect(ToolName.create('Read').value).toBe('Read');
    expect(ToolName.create('mcp__cal__create_event').value).toBe('mcp__cal__create_event');
  });
  it('rejects leading digit', () => {
    expect(() => ToolName.create('1tool')).toThrow(ValidationError);
  });
});

describe('CronExpression', () => {
  it('accepts 5-field cron', () => {
    expect(CronExpression.create('*/5 * * * *').value).toBe('*/5 * * * *');
  });
  it('rejects wrong field count', () => {
    expect(() => CronExpression.create('* * *')).toThrow(ValidationError);
  });
});

describe('EmbeddingVector', () => {
  it('creates and reports dimensions', () => {
    const v = EmbeddingVector.create([0.1, 0.2, 0.3]);
    expect(v.dimensions).toBe(3);
  });
  it('rejects empty and non-finite', () => {
    expect(() => EmbeddingVector.create([])).toThrow(ValidationError);
    expect(() => EmbeddingVector.create([1, Number.NaN])).toThrow(ValidationError);
  });
  it('equals by deep value', () => {
    expect(EmbeddingVector.create([1, 2]).equals(EmbeddingVector.create([1, 2]))).toBe(true);
    expect(EmbeddingVector.create([1, 2]).equals(EmbeddingVector.create([1, 3]))).toBe(false);
  });
});

describe('PasswordHash', () => {
  const VALID_HASH = `$2b$12$${'a'.repeat(53)}`;
  it('creates from valid bcrypt hash', () => {
    expect(PasswordHash.create(VALID_HASH).value).toBe(VALID_HASH);
  });
  it('rejects plaintext', () => {
    expect(() => PasswordHash.create('plaintext')).toThrow(ValidationError);
  });
  it('masked never leaks the hash', () => {
    const h = PasswordHash.create(VALID_HASH);
    expect(h.masked()).toBe('********');
    expect(h.toString()).not.toContain(VALID_HASH);
  });
});

describe('PlainPassword', () => {
  it('accepts a strong password', () => {
    expect(PlainPassword.create('Abcdef12').value).toBe('Abcdef12');
  });
  it('rejects too short', () => {
    expect(() => PlainPassword.create('Ab1')).toThrow(ValidationError);
  });
  it('rejects without a digit', () => {
    expect(() => PlainPassword.create('NoDigitsHere')).toThrow(ValidationError);
  });
});
