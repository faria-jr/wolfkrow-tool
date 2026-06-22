/**
 * POST /api/auth/totp-enable — verifica código e ativa TOTP.
 */

import { UnauthorizedError } from '@wolfkrow/domain';
import { EnableTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';

interface Body {
  secret: string;
  code: string;
}

const audit = getRepos().authAudit;

function getClientInfo(request: NextRequest): { ip: string | undefined; ua: string | undefined } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  return { ip, ua };
}

async function parseBody(request: NextRequest): Promise<Body | Response> {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.secret || !body?.code) {
    return Response.json({ error: 'secret and code are required' }, { status: 400 });
  }
  return body;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ip, ua } = getClientInfo(request);
  const bodyOrErr = await parseBody(request);
  if (bodyOrErr instanceof Response) return bodyOrErr;

  try {
    await new EnableTotpUseCase(getRepos().user, getAdapters().totp).execute({
      userId: session.userId,
      secret: bodyOrErr.secret,
      code: bodyOrErr.code,
    });
    audit.log({ userId: session.userId, action: 'totp.enable', ip, userAgent: ua });
    return Response.json({ enabled: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
    throw error;
  }
}
