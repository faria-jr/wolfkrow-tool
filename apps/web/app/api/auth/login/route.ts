/**
 * POST /api/auth/login — LoginUseCase (bcrypt + lockout) → JWT se success.
 *
 * A.1: auth real. Se requires_totp → 200 com challenge (frontend pede código).
 * Se locked → 423. Password fraco/ausente → 400/401 (não chama use-case).
 */


import { LockoutPolicy, PlainPassword, UnauthorizedError, ValidationError } from '@wolfkrow/domain';
import { BcryptHasher, createToken, DrizzleUserRepo, loadOrCreateKeyPair } from '@wolfkrow/infra';
import { LoginUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

interface LoginBody {
  password: string;
}

function buildLoginUseCase(): LoginUseCase {
  return new LoginUseCase(new DrizzleUserRepo(), new BcryptHasher(), new LockoutPolicy());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.password) {
    return Response.json({ error: 'Password is required' }, { status: 400 });
  }

  let password: PlainPassword;
  try {
    password = PlainPassword.create(body.password);
  } catch {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  let result;
  try {
    result = await buildLoginUseCase().execute({ password });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  if (result.status === 'locked') {
    return Response.json({ status: 'locked', lockedUntil: result.lockedUntil }, { status: 423 });
  }
  if (result.status === 'requires_totp') {
    return Response.json({ status: 'requires_totp', userId: result.userId });
  }

  await setSessionCookie(result.userId);
  return Response.json({ status: 'success', userId: result.userId });
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
