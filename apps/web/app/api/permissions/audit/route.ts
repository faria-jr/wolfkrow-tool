import { type NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  const res = await fetch(`${WORKER_URL}/permissions/audit${params ? '?' + params : ''}`, {
    headers: { Cookie: req.headers.get('cookie') ?? '' },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
