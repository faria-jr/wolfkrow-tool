/**
 * POST /api/knowledge/upload — proxies multipart file upload to the worker ingest pipeline.
 * Worker handles parse→chunk→embed→store (avoids duplicating heavy parser deps in Next.js).
 */

import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: 'Invalid multipart body' }, { status: 400 });

  const workerRes = await fetch(`${WORKER_URL}/api/knowledge/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${(session as unknown as { token: string }).token ?? ''}` },
    body: formData,
  });

  const data = (await workerRes.json()) as unknown;
  return Response.json(data, { status: workerRes.status });
}
