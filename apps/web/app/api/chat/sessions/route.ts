import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get('session')?.value;
}

export async function GET() {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await workerFetch('/chat/sessions', { bearerToken: sessionCookie });
  return Response.json(res.body, { status: res.status });
}

export async function POST() {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await workerFetch('/chat/sessions', {
    method: 'POST',
    body: {},
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}
