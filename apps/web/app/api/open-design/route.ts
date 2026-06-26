import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

/**
 * EPIC 4.2b — proxy the Open Design engine lifecycle to the worker.
 * GET  /api/open-design           → GET  WORKER/open-design/status (webUrl + daemonUrl)
 * POST /api/open-design?action=…  → POST WORKER/open-design/{start|stop}
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER}/open-design/status`);
  return Response.json(await res.json(), { status: res.status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'start';
  const endpoint = action === 'stop' ? 'stop' : 'start';

  const res = await fetch(`${WORKER}/open-design/${endpoint}`, { method: 'POST' });
  return Response.json(await res.json(), { status: res.status });
}
