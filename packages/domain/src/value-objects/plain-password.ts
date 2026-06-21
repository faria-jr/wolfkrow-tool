import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// Setup wizard: mínimo 8, ao menos 1 letra e 1 dígito (espelha SetupPasswordInput).
const plainPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Za-z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number');

/** Senha em texto plano (validada em força). Hashear antes de persistir. */
export class PlainPassword extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): PlainPassword {
    const result = plainPasswordSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('password', result.error);
    return new PlainPassword(result.data);
  }
}
