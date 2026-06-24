import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await getSession(sessionToken);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  // Forward the session JWT as a Bearer token so the worker's `authenticate`
  // hook (JWKS-verified) authorizes the request. Matches the authenticated
  // sibling proxy graph/route.ts:13-15.
  const upstream = await fetch(`${WORKER}/logs/stream${qs ? `?${qs}` : ''}`, {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
