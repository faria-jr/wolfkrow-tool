/**
 * POST /api/auth/unlock — re-verifica senha na tela de lock e reemite JWT.
 */

import { LockoutPolicy, PlainPassword, UnauthorizedError } from '@wolfkrow/domain';
import { UnlockRequestBodySchema } from '@wolfkrow/shared-types';
import { UnlockSessionUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { createToken, loadOrCreateKeyPair } from '@/lib/auth';
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

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;
  const body = validateBody(UnlockRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  let password: PlainPassword;
  try {
    password = PlainPassword.fromUnchecked(body.password);
  } catch {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  try {
    const out = await new UnlockSessionUseCase(
      getRepos().user,
      getAdapters().hasher,
      new LockoutPolicy(),
    ).execute({ password });
    await setSessionCookie(out.userId);
    audit.log({ userId: out.userId, action: 'unlock', ip, userAgent: ua });
    return Response.json({ status: 'success' });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      audit.log({ userId: undefined, action: 'login.fail', ip, userAgent: ua });
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    throw error;
  }
}
