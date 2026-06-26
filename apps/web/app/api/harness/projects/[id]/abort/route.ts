import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string }> };

/** DEBT #29 — proxy POST /harness/projects/:id/abort (server-side run abort). */
export async function POST(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const upstream = await fetch(`${WORKER}/harness/projects/${id}/abort`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return Response.json(await upstream.json(), { status: upstream.status });
}
