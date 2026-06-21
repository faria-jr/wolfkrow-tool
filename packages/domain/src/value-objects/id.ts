import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

const idSchema = z.string().uuid();

/** Identificador de entidade (UUID v4). */
export class Id extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): Id {
    const result = idSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('id', result.error);
    return new Id(result.data);
  }

  static generate(): Id {
    return new Id(randomUUID());
  }
}
