import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string }> };

/** GET /harness/projects/:id/run-events — replay persisted timeline (console restore). */
export async function GET(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const upstream = await fetch(`${WORKER}/harness/projects/${id}/run-events`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return Response.json(await upstream.json(), { status: upstream.status });
}
