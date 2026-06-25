import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

/**
 * GET /api/pipeline/projects/:id/report — proxies the worker's
 * `GeneratePipelineReportUseCase` (consolidated Markdown report of a
 * pipeline project's phases + messages) into the web app.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${WORKER}/pipeline/projects/${encodeURIComponent(id)}/report`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
