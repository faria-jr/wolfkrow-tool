import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// bcrypt: $2a/$2b/$2y + cost (2 dígitos) + 22 salt + 31 hash = 53 chars após cost.
const hashSchema = z.string().regex(/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/);

/**
 * Hash de senha bcrypt (NUNCA o plaintext). Comparação plaintext↔hash é
 * responsabilidade do infra BcryptHasher (precisa da lib bcrypt).
 */
export class PasswordHash extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): PasswordHash {
    const result = hashSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('passwordHash', result.error);
    return new PasswordHash(result.data);
  }

  /** Mascara para logs: último formato sem expor o hash. */
  masked(): string {
    return '********';
  }

  override toString(): string {
    return this.masked();
  }
}
