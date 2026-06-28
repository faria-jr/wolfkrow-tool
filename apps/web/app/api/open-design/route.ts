import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

/**
 * EPIC 4.2b — proxy the Open Design engine lifecycle to the worker.
 * GET  /api/open-design           → GET  WORKER/open-design/status (webUrl + daemonUrl)
 * POST /api/open-design?action=…  → POST WORKER/open-design/{start|stop}
 *
 * The worker requires authentication on every lifecycle route (EPIC 4.2g /
 * security hardening), so the session cookie is forwarded as a Bearer token.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value ?? null;
  if (!token || !(await getSession(token)))
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await workerFetch<{ state?: unknown; error?: string }>(
    '/open-design/status',
    { bearerToken: token }
  );
  return Response.json(res.body, { status: res.status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value ?? null;
  if (!token || !(await getSession(token)))
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'start';
  const endpoint = action === 'stop' ? 'stop' : 'start';

  const res = await workerFetch<{ ok?: boolean; state?: unknown; error?: string }>(
    `/open-design/${endpoint}`,
    { method: 'POST', bearerToken: token }
  );
  return Response.json(res.body, { status: res.status });
}
