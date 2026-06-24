import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { passphrase?: string };
  if (!body.passphrase) return Response.json({ error: 'passphrase required' }, { status: 400 });

  const res = await workerFetch('/vault/export', {
    method: 'POST',
    body: { passphrase: body.passphrase },
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}
