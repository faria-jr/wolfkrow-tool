import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.text();
  const res = await fetch(`${WORKER}/telegram/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return Response.json(await res.json(), { status: res.status });
}
