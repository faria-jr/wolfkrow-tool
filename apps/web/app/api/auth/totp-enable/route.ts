/**
 * POST /api/auth/totp-enable — verifica código e ativa TOTP.
 */

import { UnauthorizedError } from '@wolfkrow/domain';
import { EnableTotpRequestBodySchema } from '@wolfkrow/shared-types';
import { EnableTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

const audit = getRepos().authAudit;

function getClientInfo(request: NextRequest): { ip: string | undefined; ua: string | undefined } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  return { ip, ua };
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ip, ua } = getClientInfo(request);
  const body = validateBody(EnableTotpRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  try {
    await new EnableTotpUseCase(getRepos().user, getAdapters().totp).execute({
      userId: session.userId,
      secret: body.secret,
      code: body.code,
    });
    audit.log({ userId: session.userId, action: 'totp.enable', ip, userAgent: ua });
    return Response.json({ enabled: true });
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
    throw error;
  }
}
