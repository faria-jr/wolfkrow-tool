/**
 * POST /api/auth/login — LoginUseCase (bcrypt + lockout) → JWT se success.
 * Rate limit: 10/min por IP. Audit log em todas as saídas.
 */

import { LockoutPolicy, PlainPassword, UnauthorizedError, ValidationError } from '@wolfkrow/domain';
import { LoginInputSchema, LoginResponseSchema } from '@wolfkrow/shared-types';
import { LoginUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { checkRateLimit, createToken, loadOrCreateKeyPair } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

const audit = getRepos().authAudit;

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
  const body = (await request.json().catch(() => null)) as unknown;
  // Validate against the shared input contract (ADR-0005 single source of truth).
  const parsed = validateBody(LoginInputSchema, body);
  if (parsed instanceof Response) return parsed; // 400 with validation details
  try {
    return PlainPassword.create(parsed.password);
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
    result = await new LoginUseCase(getRepos().user, getAdapters().hasher, new LockoutPolicy()).execute({ password: passwordOrErr });
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
    const payload = { status: 'locked' as const, lockedUntil: result.lockedUntil };
    const validated = validateBody(LoginResponseSchema, payload);
    if (validated instanceof Response) return validated; // 400 on contract drift
    return Response.json(validated, { status: 423 });
  }
  if (result.status === 'requires_totp') {
    const payload = { status: 'requires_totp' as const, userId: result.userId };
    const validated = validateBody(LoginResponseSchema, payload);
    if (validated instanceof Response) return validated;
    return Response.json(validated);
  }

  await setSessionCookie(result.userId);
  audit.log({ userId: result.userId, action: 'login.success', ip, userAgent: ua });
  const payload = { status: 'success' as const, userId: result.userId };
  const validated = validateBody(LoginResponseSchema, payload);
  if (validated instanceof Response) return validated;
  return Response.json(validated);
}
