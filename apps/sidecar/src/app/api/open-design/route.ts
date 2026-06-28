import { NextResponse } from 'next/server';

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:3001';

function workerUrl(path: string): string {
  return `${WORKER_URL}${path}`;
}

async function fetchWorker(path: string, init?: RequestInit) {
  const res = await fetch(workerUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
    },
  });
  return res;
}

export async function GET() {
  try {
    const res = await fetchWorker('/api/open-design/status');
    const body = await res.json().catch(() => ({ state: { status: 'unknown' } }));
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ state: { status: 'offline', webUrl: null, daemonUrl: null } });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = (await request.json().catch(() => ({}))) as { action?: string };
    const path =
      action === 'start'
        ? '/api/open-design/start'
        : action === 'stop'
          ? '/api/open-design/stop'
          : null;
    if (!path) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    const res = await fetchWorker(path, { method: 'POST', body: '{}' });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'Worker unreachable' }, { status: 503 });
  }
}
