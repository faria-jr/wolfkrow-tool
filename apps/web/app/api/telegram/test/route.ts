import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(_req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER}/telegram/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  return Response.json(await res.json(), { status: res.status });
}
