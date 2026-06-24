/**
 * Server-side helper to call worker endpoints from web API routes.
 *
 * The worker authenticates via JWT Bearer (aud: 'wolfkrow-worker') using the
 * shared ES256 keypair that the web owns. The cookie session IS the JWT
 * (see `lib/auth.ts`), so we forward it as `Authorization: Bearer <session>`
 * and the worker authenticates without needing a separate token.
 *
 * (M3.5 — used by mcp-servers/[id]/{health,restart} proxies.)
 */

// Prefer server-only WORKER_URL; fall back to NEXT_PUBLIC_WORKER_URL for backward compat.
const WORKER_URL = process.env.WORKER_URL ?? process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

export interface WorkerFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer token. Pass the cookie session value verbatim. */
  bearerToken?: string;
}

export async function workerFetch<T>(
  path: string,
  options: WorkerFetchOptions = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.bearerToken) headers['Authorization'] = `Bearer ${options.bearerToken}`;

  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    return { status: 503, body: { error: 'Worker unavailable' } as unknown as T };
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}
