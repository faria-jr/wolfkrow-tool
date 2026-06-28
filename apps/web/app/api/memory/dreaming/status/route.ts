import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

// Dreaming status lives in the worker's in-memory DreamingGateRegistry, so this
// must proxy to the worker (the DB-shared direct pattern can't see it).
export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${WORKER_URL}/memory/dreaming/status`, {
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
