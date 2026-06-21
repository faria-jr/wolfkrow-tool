import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string; phaseId: string }> };

export async function POST(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, phaseId } = await params;
  const body = await req.text();
  const res = await fetch(`${WORKER}/pipeline/projects/${id}/phases/${phaseId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body || '{}',
  });
  return Response.json(await res.json(), { status: res.status });
}
