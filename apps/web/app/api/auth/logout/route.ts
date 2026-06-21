/**
 * POST /api/auth/logout — limpa o cookie de sessão.
 */

import { cookies } from 'next/headers';

export async function POST() {
  const store = await cookies();
  store.delete('session');
  return Response.json({ success: true });
}
