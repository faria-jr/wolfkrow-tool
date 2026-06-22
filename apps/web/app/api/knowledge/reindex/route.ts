/**
 * POST /api/knowledge/reindex/:id — re-embed all chunks for a document.
 * Proxied to worker.
 */

import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workerRes = await fetch(`${WORKER_URL}/api/knowledge/reindex`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(session as unknown as { token: string }).token ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await workerRes.json()) as unknown;
  return Response.json(data, { status: workerRes.status });
}
