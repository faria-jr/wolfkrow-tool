import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${WORKER}/pipeline/projects/${id}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return Response.json(await res.json(), { status: res.status });
}

export async function DELETE(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${WORKER}/pipeline/projects/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  return Response.json(await res.json(), { status: res.status });
}
