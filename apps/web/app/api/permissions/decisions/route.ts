/**
 * Proxy for the durable tool-permission decisions (P2-1 / P1-7).
 *
 * Forwards GET/PUT/DELETE to the worker `/permissions/decisions` route so the
 * web UI can manage allow/deny decisions. Writes MUST go through the worker
 * (not the web's own DB handle) so the worker's in-memory decision cache stays
 * coherent — otherwise a freshly-set "deny" would not take effect until the
 * worker restarted.
 */

import { type NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

function forwardHeaders(req: NextRequest): HeadersInit {
  return { Cookie: req.headers.get('cookie') ?? '' };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const res = await fetch(`${WORKER_URL}/permissions/decisions${params ? '?' + params : ''}`, {
    headers: forwardHeaders(req),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${WORKER_URL}/permissions/decisions`, {
    method: 'PUT',
    headers: { ...forwardHeaders(req), 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${WORKER_URL}/permissions/decisions`, {
    method: 'DELETE',
    headers: { ...forwardHeaders(req), 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
