import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

// Forces a manual dreaming run in the worker (DreamingGateRegistry.triggerNow).
export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER_URL}/memory/dreaming/trigger`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
