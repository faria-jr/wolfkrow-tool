/**
 * GET /api/auth/totp-setup — gera secret + URL otpauth para QR code.
 * Não ativa TOTP — apenas fornece dados para setup.
 */

import { SetupTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const out = await new SetupTotpUseCase(getRepos().user, getAdapters().totp).execute({
    userId: session.userId,
  });
  return Response.json(out);
}
