import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

const vectorSchema = z.array(z.number().finite()).min(1).max(8192);

/** Vetor de embedding (float, finito, não-vazio). Deep equality via base. */
export class EmbeddingVector extends ValueObject<number[]> {
  private constructor(value: number[]) {
    super(value);
  }

  static create(values: number[]): EmbeddingVector {
    const result = vectorSchema.safeParse(values);
    if (!result.success) throw ValidationError.fromZod('embedding', result.error);
    return new EmbeddingVector(result.data);
  }

  get dimensions(): number {
    return this.value.length;
  }
}
