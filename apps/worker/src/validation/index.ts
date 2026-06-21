/**
 * H.2 — Zod runtime validation helper.
 *
 * Use `validate(schema, body)` inside route handlers to parse + strip unknown
 * fields from untrusted input. Throws a 400 FastifyError on failure so
 * Fastify's error handler returns a JSON error automatically.
 *
 * We don't use fastify-type-provider-zod to keep the migration surgical —
 * existing routes get validation added one field at a time without a big
 * refactor of all type generics.
 */

import { z, type ZodTypeDef, type ZodType } from 'zod';

export { z };
export * from './schemas';

export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Parse `input` with `schema` and return the typed result.
 * Throws `ValidationError` (statusCode 400) on failure.
 *
 * Uses `ZodType<T, Def, unknown>` (input=unknown) so TypeScript infers T from
 * the OUTPUT type only — this ensures `.default()` fields appear as non-optional.
 */
export function validate<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const msg = result.error.errors
      .map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
      .join('; ');
    throw new ValidationError(msg);
  }
  return result.data;
}
