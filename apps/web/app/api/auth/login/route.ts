/**
 * POST /api/auth/login — LoginUseCase (bcrypt + lockout) → JWT se success.
 * Rate limit: 10/min por IP. Audit log em todas as saídas.
 */

import { LockoutPolicy, PlainPassword, UnauthorizedError, ValidationError } from '@wolfkrow/domain';
import {
  BcryptHasher,
  checkRateLimit,
  createToken,
  DrizzleAuthAuditRepo,
  DrizzleUserRepo,
  loadOrCreateKeyPair,
} from '@wolfkrow/infra';
import { LoginUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

interface LoginBody {
  password: string;
}

const audit = new DrizzleAuthAuditRepo();

async function setSessionCookie(userId: string): Promise<void> {
  const { privateKey } = await loadOrCreateKeyPair();
  const token = await createToken({ sub: userId, userId }, privateKey);
  const store = await cookies();
  store.set('session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

function getClientInfo(request: NextRequest): { ip: string; ua: string | undefined } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? undefined;
  return { ip, ua };
}

async function parsePassword(request: NextRequest): Promise<PlainPassword | Response> {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.password) return Response.json({ error: 'Password is required' }, { status: 400 });
  try {
    return PlainPassword.create(body.password);
  } catch {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const { ip, ua } = getClientInfo(request);

  if (!checkRateLimit(`login:${ip}`)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const passwordOrErr = await parsePassword(request);
  if (passwordOrErr instanceof Response) return passwordOrErr;

  let result;
  try {
    result = await new LoginUseCase(new DrizzleUserRepo(), new BcryptHasher(), new LockoutPolicy()).execute({ password: passwordOrErr });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      audit.log({ userId: undefined, action: 'login.fail', ip, userAgent: ua });
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  if (result.status === 'locked') {
    audit.log({ userId: undefined, action: 'login.fail', ip, userAgent: ua });
    return Response.json({ status: 'locked', lockedUntil: result.lockedUntil }, { status: 423 });
  }
  if (result.status === 'requires_totp') {
    return Response.json({ status: 'requires_totp', userId: result.userId });
  }

  await setSessionCookie(result.userId);
  audit.log({ userId: result.userId, action: 'login.success', ip, userAgent: ua });
  return Response.json({ status: 'success', userId: result.userId });
}
