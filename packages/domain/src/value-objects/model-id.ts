import { z } from 'zod';

import { ValidationError } from '../errors/domain-error';

import { ValueObject } from './base-value-object';

// Provider/model: "claude-sonnet-4-6", "gpt-4o", "gemini-1.5-pro",
// "accounts/fireworks/models/llama-v3".
const modelIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9./:_-]{0,127}$/);

/** Identificador de modelo de IA (provider + modelo). */
export class ModelId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): ModelId {
    const result = modelIdSchema.safeParse(value);
    if (!result.success) throw ValidationError.fromZod('modelId', result.error);
    return new ModelId(result.data);
  }
}
