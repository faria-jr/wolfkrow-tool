/**
 * Pagination helper for listing endpoints (F5.1).
 *
 * Reads `limit`/`offset` query params with safe defaults (20 / 0), applies them
 * to a source array (or to a { items, total } pair when the repo already counts),
 * and returns the standardized paginated envelope:
 *   { items, total, limit, offset, hasMore }
 *
 * Routes that already return a plain array call `paginateArray(req, items)`.
 * Routes whose repo returns a total (so a full COUNT isn't needed) call
 * `paginateTotal(req, items, total)`.
 */

export interface PaginatedEnvelope<T> {
  items: readonly T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginationQuery {
  limit?: string;
  offset?: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function readParams(query: PaginationQuery): { limit: number; offset: number } {
  const limitRaw = Number(query.limit);
  const offsetRaw = Number(query.offset);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  return { limit, offset };
}

/** Paginate a fully-fetched array (small lists; repo has no count).
 *  When `legacyKey` is given, the raw array is also copied under that key so
 *  existing web consumers (reading `.skills`, `.tasks`, …) keep working while
 *  they migrate to the paginated envelope. */
export function paginateArray<T>(
  query: PaginationQuery,
  items: readonly T[],
  legacyKey?: string
): PaginatedEnvelope<T> & Record<string, unknown> {
  const { limit, offset } = readParams(query);
  const total = items.length;
  const slice = items.slice(offset, offset + limit);
  const envelope: PaginatedEnvelope<T> & Record<string, unknown> = {
    items: slice,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
  if (legacyKey) envelope[legacyKey] = items;
  return envelope;
}

/** Paginate when the caller already knows the total (repo did a COUNT). */
export function paginateTotal<T>(
  query: PaginationQuery,
  items: readonly T[],
  total: number
): PaginatedEnvelope<T> {
  const { limit, offset } = readParams(query);
  return { items, total, limit, offset, hasMore: offset + items.length < total };
}

/** Apply pagination to a Fastify querystring (string-valued params). */
export function fromQuery(query: unknown): PaginationQuery {
  if (query && typeof query === 'object') {
    const q = query as Record<string, unknown>;
    return {
      ...(typeof q['limit'] === 'string' ? { limit: q['limit'] } : {}),
      ...(typeof q['offset'] === 'string' ? { offset: q['offset'] } : {}),
    };
  }
  return {};
}
