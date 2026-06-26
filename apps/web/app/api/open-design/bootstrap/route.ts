import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { workerFetch } from '@/lib/worker-fetch';

/** EPIC 4.2e — proxy POST /open-design/bootstrap to the worker. */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value ?? null;
  if (!token || !(await getSession(token))) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const res = await workerFetch('/open-design/bootstrap', { method: 'POST', bearerToken: token, body });
  return Response.json(res.body, { status: res.status });
}
