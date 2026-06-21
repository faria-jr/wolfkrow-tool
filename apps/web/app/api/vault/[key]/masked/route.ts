import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { key } = await params;
  const res = await fetch(`${WORKER}/vault/${encodeURIComponent(key)}/masked`);
  return Response.json(await res.json(), { status: res.status });
}
