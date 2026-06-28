import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

/**
 * GET /api/harness/sprints/:sprintId/rounds — proxies the worker's
 * `GET /harness/sprints/:sprintId/rounds` endpoint so the web UI can
 * render the Coder→Evaluator round history (and per-round diffs) for
 * a sprint without bypassing the worker's auth gate.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { sprintId } = await params;
  const res = await fetch(`${WORKER}/harness/sprints/${encodeURIComponent(sprintId)}/rounds`);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
