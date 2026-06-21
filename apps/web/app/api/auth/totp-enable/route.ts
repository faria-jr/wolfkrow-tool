/**
 * POST /api/auth/totp-enable — verifica código e ativa TOTP.
 */

import { UnauthorizedError } from '@wolfkrow/domain';
import { DrizzleAuthAuditRepo, DrizzleUserRepo, OtplibTotp } from '@wolfkrow/infra';
import { EnableTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';

interface Body {
  secret: string;
  code: string;
}

const audit = new DrizzleAuthAuditRepo();

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.secret || !body?.code) {
    return Response.json({ error: 'secret and code are required' }, { status: 400 });
  }

  try {
    await new EnableTotpUseCase(new DrizzleUserRepo(), new OtplibTotp()).execute({
      userId: session.userId,
      secret: body.secret,
      code: body.code,
    });
    audit.log({ userId: session.userId, action: 'totp.enable', ip, userAgent: ua });
    return Response.json({ enabled: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
    }
    throw error;
  }
}
