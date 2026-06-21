/**
 * POST /api/auth/totp-disable — verifica senha + código e desativa TOTP.
 */

import { LockoutPolicy, PlainPassword, UnauthorizedError } from '@wolfkrow/domain';
import { BcryptHasher, DrizzleAuthAuditRepo, DrizzleUserRepo, OtplibTotp } from '@wolfkrow/infra';
import { DisableTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { getSession } from '@/lib/auth';

interface Body {
  password: string;
  code: string | undefined;
}

const audit = new DrizzleAuthAuditRepo();

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.password) {
    return Response.json({ error: 'Password is required' }, { status: 400 });
  }

  let password: PlainPassword;
  try {
    password = PlainPassword.create(body.password);
  } catch {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  try {
    await new DisableTotpUseCase(
      new DrizzleUserRepo(),
      new BcryptHasher(),
      new OtplibTotp(),
      new LockoutPolicy(),
    ).execute({ userId: session.userId, password, code: body.code });
    audit.log({ userId: session.userId, action: 'totp.disable', ip, userAgent: ua });
    return Response.json({ disabled: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
