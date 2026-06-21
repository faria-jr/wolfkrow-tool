/**
 * GET /api/auth/totp-setup — gera secret + URL otpauth para QR code.
 * Não ativa TOTP — apenas fornece dados para setup.
 */

import { DrizzleUserRepo, OtplibTotp } from '@wolfkrow/infra';
import { SetupTotpUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const out = await new SetupTotpUseCase(new DrizzleUserRepo(), new OtplibTotp()).execute({
    userId: session.userId,
  });
  return Response.json(out);
}
