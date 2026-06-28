import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const res = await fetch(`${WORKER_URL}/permissions/audit${params ? '?' + params : ''}`, {
    headers: { 'Authorization': `Bearer ${sessionCookie}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
