import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${WORKER}/harness/projects/${id}/sprints`, {
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  return Response.json(await res.json(), { status: res.status });
}
