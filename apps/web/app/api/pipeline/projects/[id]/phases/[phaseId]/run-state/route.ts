import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string; phaseId: string }> };

/** Proxy GET /pipeline/.../run-state — current phase run control state. */
export async function GET(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, phaseId } = await params;
  const res = await fetch(`${WORKER}/pipeline/projects/${id}/phases/${phaseId}/run-state`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return Response.json(await res.json(), { status: res.status });
}
