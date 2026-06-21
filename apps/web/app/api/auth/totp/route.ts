/**
 * POST /api/auth/totp — VerifyTotpUseCase (2º fator) → JWT cookie se válido.
 * Vem após login que retornou requires_totp.
 */


import { NotFoundError, UnauthorizedError } from '@wolfkrow/domain';
import {
  createToken,
  DrizzleUserRepo,
  loadOrCreateKeyPair,
  OtplibTotp,
} from '@wolfkrow/infra';
import { VerifyTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

interface TotpBody {
  userId: string;
  code: string;
}

async function setSessionCookie(userId: string): Promise<void> {
  const { privateKey } = await loadOrCreateKeyPair();
  const token = await createToken({ sub: userId, userId }, privateKey);
  const store = await cookies();
  store.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TotpBody | null;
  if (!body?.userId || !body?.code) {
    return Response.json({ error: 'userId and code are required' }, { status: 400 });
  }

  try {
    const out = await new VerifyTotpUseCase(
      new DrizzleUserRepo(),
      new OtplibTotp(),
    ).execute({ userId: body.userId, code: body.code });
    await setSessionCookie(out.userId);
    return Response.json({ status: 'success', userId: out.userId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Invalid TOTP code' }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    throw error;
  }
}
