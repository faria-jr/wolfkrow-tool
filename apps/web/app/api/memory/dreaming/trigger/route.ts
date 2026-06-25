import { NextResponse } from 'next/server';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

// Forces a manual dreaming run in the worker (DreamingGateRegistry.triggerNow).
export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const res = await fetch(`${WORKER_URL}/memory/dreaming/trigger`, { method: 'POST', headers });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
