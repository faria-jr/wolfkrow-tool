import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

const isoSchema = z.string().datetime({ offset: true });

/** Instante no tempo como ISO 8601 (serializável). Timezone America/Sao_Paulo. */
export class Timestamp extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): Timestamp {
    const result = isoSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('timestamp', result.error);
    return new Timestamp(result.data);
  }

  static now(): Timestamp {
    return new Timestamp(new Date().toISOString());
  }

  toDate(): Date {
    return new Date(this.value);
  }
}
