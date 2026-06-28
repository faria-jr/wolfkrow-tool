import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

async function proxy(request: Request, path: string, sessionCookie: string): Promise<NextResponse> {
  const url = `${WORKER_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionCookie}`,
  };

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== 'GET') {
    init.body = await request.text();
  }
  const res = await fetch(url, init);
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return proxy(request, '/audit/run', sessionCookie);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value ?? '';
  const session = await getSession(sessionCookie);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');
  if (scanId) {
    const type = searchParams.get('type');
    if (type === 'findings') return proxy(request, `/audit/scans/${scanId}/findings`, sessionCookie);
    return proxy(request, `/audit/scans/${scanId}`, sessionCookie);
  }
  return proxy(request, '/audit/scans', sessionCookie);
}
