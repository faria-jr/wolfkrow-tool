import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

interface Params { params: Promise<{ id: string }>; }

async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get('session')?.value;
}

export async function PATCH(request: Request, { params }: Params) {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as { title?: string; archived?: boolean };
  const res = await workerFetch(`/chat/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const res = await workerFetch(`/chat/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}
