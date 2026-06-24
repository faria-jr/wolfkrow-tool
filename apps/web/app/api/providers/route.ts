import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value ?? null;
  if (!token) return null;
  const session = await getSession(token);
  return session ? token : null;
}

export async function GET() {
  const token = await getAuthToken();
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const res = await workerFetch('/api/providers', { method: 'GET', bearerToken: token });
  return Response.json(res.body, { status: res.status });
}

export async function POST(request: Request) {
  const token = await getAuthToken();
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const res = await workerFetch('/api/providers', { method: 'POST', body, bearerToken: token });
  return Response.json(res.body, { status: res.status });
}
