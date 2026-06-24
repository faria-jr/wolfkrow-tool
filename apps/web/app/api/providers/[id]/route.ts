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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const res = await workerFetch(`/api/providers/${id}`, { method: 'DELETE', bearerToken: token });
  return new Response(null, { status: res.status });
}
