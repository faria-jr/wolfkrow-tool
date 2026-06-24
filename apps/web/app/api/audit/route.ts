import { NextResponse } from 'next/server';

const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';

async function proxy(request: Request, path: string): Promise<NextResponse> {
  const url = `${WORKER_URL}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== 'GET') {
    init.body = await request.text();
  }
  const res = await fetch(url, init);
  const data = await res.text();
  return new NextResponse(data, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' } });
}

export async function POST(request: Request) {
  return proxy(request, '/audit/run');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');
  if (scanId) {
    const type = searchParams.get('type');
    if (type === 'findings') return proxy(request, `/audit/scans/${scanId}/findings`);
    return proxy(request, `/audit/scans/${scanId}`);
  }
  return proxy(request, '/audit/scans');
}
