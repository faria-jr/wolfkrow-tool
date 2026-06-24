import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { passphrase?: string; payload?: unknown };
  if (!body.passphrase || !body.payload) {
    return Response.json({ error: 'passphrase and payload required' }, { status: 400 });
  }

  const res = await workerFetch('/vault/import', {
    method: 'POST',
    body: { passphrase: body.passphrase, payload: body.payload },
    bearerToken: sessionCookie,
  });
  return Response.json(res.body, { status: res.status });
}
