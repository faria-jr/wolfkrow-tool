import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

const emailSchema = z.string().trim().toLowerCase().max(254).email();

/** Endereço de e-mail normalizado (lowercase, trimmed). */
export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): Email {
    const result = emailSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('email', result.error);
    return new Email(result.data);
  }
}
