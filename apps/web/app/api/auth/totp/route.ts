/**
 * POST /api/auth/totp — VerifyTotpUseCase (2º fator) → JWT cookie se válido.
 * Vem após login que retornou requires_totp.
 */

import { NotFoundError, UnauthorizedError } from '@wolfkrow/domain';
import { VerifyTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { createToken, loadOrCreateKeyPair } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';

interface TotpBody {
  userId: string;
  code: string;
}

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

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const ua = request.headers.get('user-agent') ?? undefined;
  const body = (await request.json().catch(() => null)) as TotpBody | null;

  if (!body?.userId || !body?.code) {
    return Response.json({ error: 'userId and code are required' }, { status: 400 });
  }

  try {
    const out = await new VerifyTotpUseCase(getRepos().user, getAdapters().totp).execute({
      userId: body.userId,
      code: body.code,
    });
    await setSessionCookie(out.userId);
    audit.log({ userId: out.userId, action: 'totp.success', ip, userAgent: ua });
    return Response.json({ status: 'success', userId: out.userId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      audit.log({ userId: body.userId, action: 'totp.fail', ip, userAgent: ua });
      return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    throw error;
  }
}
