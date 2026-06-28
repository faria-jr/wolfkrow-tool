import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workerBase = process.env['WORKER_URL'] ?? 'http://localhost:4000';

  const res = await fetch(`${workerBase}/scheduler/tasks/${id}/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });

  const data = (await res.json()) as unknown;
  return Response.json(data, { status: res.status });
}
