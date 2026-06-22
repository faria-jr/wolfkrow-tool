/**
 * POST /api/auth/totp-disable — verifica senha + código e desativa TOTP.
 */

import { LockoutPolicy, PlainPassword, UnauthorizedError } from '@wolfkrow/domain';
import { DisableTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';

interface Body {
  password: string;
  code: string | undefined;
}

const audit = getRepos().authAudit;

function getClientInfo(request: NextRequest): { ip: string | undefined; ua: string | undefined } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  return { ip, ua };
}

async function parsePasswordFromBody(request: NextRequest): Promise<{ password: PlainPassword; code: string | undefined } | Response> {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.password) return Response.json({ error: 'Password is required' }, { status: 400 });
  try {
    return { password: PlainPassword.create(body.password), code: body.code };
  } catch {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ip, ua } = getClientInfo(request);
  const parsed = await parsePasswordFromBody(request);
  if (parsed instanceof Response) return parsed;

  try {
    await new DisableTotpUseCase(
      getRepos().user,
      getAdapters().hasher,
      getAdapters().totp,
      new LockoutPolicy(),
    ).execute({ userId: session.userId, password: parsed.password, code: parsed.code });
    audit.log({ userId: session.userId, action: 'totp.disable', ip, userAgent: ua });
    return Response.json({ disabled: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }
}
