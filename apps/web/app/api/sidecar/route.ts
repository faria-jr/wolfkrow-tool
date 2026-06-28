import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER}/sidecar/status`, {
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  return Response.json(await res.json(), { status: res.status });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'start';
  const endpoint = action === 'stop' ? 'stop' : 'start';

  const res = await fetch(`${WORKER}/sidecar/${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  return Response.json(await res.json(), { status: res.status });
}
