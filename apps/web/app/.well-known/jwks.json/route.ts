/**
 * GET /.well-known/jwks.json — JWKS público (chave de verificação ES256).
 * Endpoint DEDICADO (corrige G2: antes worker buscava JWKS no GET do login).
 * Worker valida tokens via createRemoteJWKSet(this URL) — config JWKS_URL.
 */

import { loadOrCreateKeyPair } from '@/lib/auth';

export async function GET() {
  const { publicJwk } = await loadOrCreateKeyPair();

  return Response.json({
    keys: [
      {
        ...publicJwk,
        alg: 'ES256',
        use: 'sig',
        kid: 'wolfkrow-jwt-1',
      },
    ],
  });
}
