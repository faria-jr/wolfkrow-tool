import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = `${WORKER_URL}/api/profiler`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionCookie}`,
  };

  const body = await request.text();
  const res = await fetch(url, { method: 'POST', headers, body });
  const data = await res.text();
  if (res.status === 401) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
