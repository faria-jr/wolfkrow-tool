/**
 * Web boundary validation helper (ADR-0005).
 *
 * Next.js route handlers have no central error handler, so each handler that
 * parses a Zod schema must map a `ZodError` to a 400 response itself. This
 * helper is the single place that mapping lives.
 *
 * Usage:
 *   const result = validateBody(schema, await request.json());
 *   if (result instanceof Response) return result; // 400 already built
 *   // result is typed as z.infer<typeof schema>
 */

import { ZodError, type ZodType } from 'zod';

/**
 * Validate `input` against `schema`.
 *
 * Returns the parsed value on success, or a `Response` (status 400) on failure.
 * Callers MUST check `instanceof Response` before using the value.
 */
export function validateBody<T>(schema: ZodType<T>, input: unknown): T | Response {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        path: e.path.join('.') || 'body',
        message: e.message,
      }));
      return Response.json(
        { error: 'Validation error', code: 'VALIDATION_ERROR', details },
        { status: 400 }
      );
    }
    throw error;
  }
}
