import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  const session = await getSession(sessionCookie);
  if (!session)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  const body = await request.text();
  const workerRes = await fetch(`${WORKER}/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionCookie}`,
      Accept: 'text/event-stream',
    },
    body,
  });

  if (!workerRes.ok || !workerRes.body) {
    return new Response(JSON.stringify({ error: `Worker error: ${workerRes.status}` }), {
      status: workerRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(workerRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
