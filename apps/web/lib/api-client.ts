/**
 * FE-4 — Typed client layer for the web↔worker boundary.
 *
 * Every helper here:
 *   - targets a CRITICAL endpoint whose contract lives in `@wolfkrow/shared-types`
 *   - runs `Schema.parse()` on the parsed JSON response (fail early if BE diverges)
 *   - returns the typed value OR throws an `ApiClientError` with status + message
 *
 * Components should import from here instead of doing raw `fetch(...) as Record<...>`,
 * which silently accepted any shape. New endpoints: follow this pattern — define a
 * helper, import the shared schema, parse the response.
 *
 * NOTE: chat streaming (`/chat/send`) is intentionally NOT here — it uses SSE and
 * is handled by `components/chat/sse.ts` (now resilient per-line).
 */

import {
  LoginResponseSchema,
  SearchQuerySchema,
  SecretMetadataSchema,
  UsageSummarySchema,
} from '@wolfkrow/shared-types';
import type { LoginResponse, SecretMetadata, UsageSummary } from '@wolfkrow/shared-types';
import { z } from 'zod';

/** Error raised when the API returns a non-ok status or a shape that fails parse. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Low-level helper: fetch JSON, parse with `schema`, throw `ApiClientError` on
 * failure. Centralizes the parse-or-fail discipline so call sites stay small.
 *
 * - HTTP non-ok → `ApiClientError` with the upstream message when available.
 * - HTTP ok but body fails `schema.parse()` → `ApiClientError` (BE diverged).
 */
/** Read a Response body and JSON-parse it, falling back to raw text. */
async function safeJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  try {
    return raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}

/** Parse a Response body against a schema, throwing ApiClientError on mismatch. */
async function parseBody<S extends z.ZodType>(
  res: Response,
  schema: S,
  url: string
): Promise<z.output<S>> {
  const parsed = await safeJson(res);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ApiClientError(
      `Response shape mismatch for ${url}: ${result.error.message}`,
      res.status,
      parsed
    );
  }
  return result.data;
}

async function request<S extends z.ZodType>(
  url: string,
  schema: S,
  init?: RequestInit
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', ...init });
  } catch (err) {
    throw new ApiClientError(err instanceof Error ? err.message : 'Network request failed', 0);
  }

  if (!res.ok) {
    const parsed = await safeJson(res);
    throw new ApiClientError(errorMessage(parsed, res.status), res.status, parsed);
  }

  return parseBody(res, schema, url);
}

// ---------------------------------------------------------------------------
// Auth — POST /api/auth/login
// ---------------------------------------------------------------------------

export interface LoginOptions {
  password: string;
}

/**
 * Login. Returns the discriminated `LoginResponse` (success | requires_totp | locked).
 *
 * The server returns HTTP 423 for the `locked` branch — that is a *contract*
 * response (not an error), so we parse the body on 423 too rather than throwing.
 * Genuine errors (400/401/429) throw `ApiClientError`.
 */
/** Extract a human message from a parsed error body, falling back to HTTP status. */
function errorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    return String((parsed as Record<string, unknown>).error);
  }
  return `HTTP ${status}`;
}

export async function login({ password }: LoginOptions): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch (err) {
    throw new ApiClientError(err instanceof Error ? err.message : 'Network request failed', 0);
  }

  // 423 (locked) is a valid contract response — delegate to request() which
  // parses the body. request() treats 423 as non-ok and would throw, so we
  // handle the ok + 423 cases inline here.
  if (res.ok || res.status === 423) {
    return parseBody(res, LoginResponseSchema, '/api/auth/login');
  }

  // Genuine error (400/401/429…) — extract message and throw.
  const parsed = await safeJson(res);
  throw new ApiClientError(errorMessage(parsed, res.status), res.status, parsed);
}

// ---------------------------------------------------------------------------
// Usage — GET /api/usage/summary
// ---------------------------------------------------------------------------

export interface UsageSummaryOptions {
  from?: string;
  to?: string;
}

/** Fetch the usage summary. Runs `UsageSummarySchema.parse()` on the response. */
export function getUsageSummary(opts: UsageSummaryOptions = {}): Promise<UsageSummary> {
  const qs = new URLSearchParams();
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request(`/api/usage/summary${suffix}`, UsageSummarySchema);
}

// ---------------------------------------------------------------------------
// Knowledge — POST /api/knowledge/search
// ---------------------------------------------------------------------------

/**
 * Flattened search-result item as emitted by the `/api/knowledge/search` route.
 *
 * The route projects `SearchResult` (`{ chunk, score, document }`) into this
 * flatter shape for the browser. This schema is the client-side contract for
 * that projection — `searchKnowledge()` parses every response against it.
 */
const KnowledgeSearchItemSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()).default({}),
});

export type KnowledgeSearchItem = z.infer<typeof KnowledgeSearchItemSchema>;

export interface KnowledgeSearchOptions {
  query: string;
  documentIds?: string[];
  limit?: number;
}

/**
 * Semantic search. Validates the request with `SearchQuerySchema` (client-side)
 * and the response array with `KnowledgeSearchItemSchema`.
 */
export async function searchKnowledge(
  opts: KnowledgeSearchOptions
): Promise<KnowledgeSearchItem[]> {
  const body = SearchQuerySchema.parse({
    query: opts.query,
    ...(opts.documentIds ? { documentIds: opts.documentIds } : {}),
    ...(opts.limit ? { limit: opts.limit } : {}),
  });
  const wrapper = z.object({ results: z.array(KnowledgeSearchItemSchema) });
  const data = await request('/api/knowledge/search', wrapper, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return data.results;
}

// ---------------------------------------------------------------------------
// Vault — GET /api/vault
// ---------------------------------------------------------------------------

/**
 * List vault secret metadata (values never reach the browser).
 * The proxy returns `{ secrets: SecretMetadata[] }`.
 */
export async function listVaultSecrets(): Promise<SecretMetadata[]> {
  const wrapper = z.object({ secrets: z.array(SecretMetadataSchema) });
  const data = await request('/api/vault', wrapper);
  return data.secrets;
}
