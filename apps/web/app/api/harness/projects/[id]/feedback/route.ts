import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string }> };

/** POST /harness/projects/:id/feedback — operator HITL feedback for a feature. */
export async function POST(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const upstream = await fetch(`${WORKER}/harness/projects/${id}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(body),
  });
  return Response.json(await upstream.json(), { status: upstream.status });
}
