/**
 * Worker HTTP client for built-in MCP servers.
 *
 * Each server is a thin bridge: it declares its tools statically (so
 * `tools/list` needs no I/O) and, on `tools/call`, forwards to the worker's
 * authenticated HTTP API. The auth token and worker URL come from the
 * environment the McpManager sets when spawning the process.
 */

const DEFAULT_WORKER_URL = 'http://localhost:4000';

export interface WorkerClientOptions {
  baseUrl?: string;
  authToken?: string;
}

export interface WorkerClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function createWorkerClient(opts: WorkerClientOptions = {}): WorkerClient {
  const baseUrl = trimTrailingSlash(
    opts.baseUrl ?? process.env['WOLFKROW_WORKER_URL'] ?? DEFAULT_WORKER_URL
  );
  const token = opts.authToken ?? process.env['WOLFKROW_AUTH_TOKEN'];

  async function request(path: string, init: RequestInit): Promise<unknown> {
    if (!token) {
      throw new Error(
        'WOLFKROW_AUTH_TOKEN not set — MCP server cannot call authenticated worker routes'
      );
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Worker ${path} -> ${res.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  };
}
