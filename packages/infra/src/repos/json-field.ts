/** Cast JSON column values (Drizzle returns `unknown`) to typed domain objects. */

export function fromJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as T;
}

export function fromJsonRequired<T>(value: unknown): T {
  if (value === null || value === undefined) throw new Error('Expected non-null JSON field from DB');
  return value as T;
}

export function asJsonField(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}
