/**
 * POST /api/auth/lock — bloqueia a sessão (limpa cookie e loga 'lock').
 */

import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

const audit = getRepos().authAudit;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;

  if (session) {
    audit.log({ userId: session.userId, action: 'lock', ip, userAgent: ua });
  }

  cookieStore.delete('session');
  return Response.json({ locked: true });
}
