/**
 * Sidecar auth probe — called by the sidecar middleware to verify the
 * Bearer token forwarded from the web app.
 *
 * Delegates verification to the worker's JWKS endpoint so the sidecar
 * itself never holds keys.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const WORKER = process.env['WORKER_URL'] ?? 'http://localhost:4000';
const JWKS_URL = new URL('/.well-known/jwks.json', WORKER);
const JWKS = createRemoteJWKSet(JWKS_URL);

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, JWKS, { algorithms: ['ES256'] });
    return Response.json({ ok: true, userId: payload['sub'] });
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
