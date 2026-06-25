import { NextResponse } from 'next/server';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const url = `${WORKER_URL}/api/profiler`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;
  const cookie = request.headers.get('cookie');
  if (cookie) headers['Cookie'] = cookie;

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
