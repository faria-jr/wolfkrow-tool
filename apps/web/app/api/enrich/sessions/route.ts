import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function GET(_req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER}/enrich/sessions?userId=${session.userId}`);
  return Response.json(await res.json(), { status: res.status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const res = await fetch(`${WORKER}/enrich/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: session.userId }),
  });
  return Response.json(await res.json(), { status: res.status });
}
