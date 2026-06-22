import { loadOrCreateKeyPair } from '@wolfkrow/infra';
import { jwtVerify } from 'jose';

/**
 * Auth-infra bridge (FIX-007): web routes must not import `@wolfkrow/infra`
 * directly. These JWT / rate-limit / keypair helpers are infra utilities (not
 * adapter instances), so this module is the single web file that re-exports
 * them. Routes import them from `@/lib/auth`.
 */
export { checkRateLimit, createToken, loadOrCreateKeyPair } from '@wolfkrow/infra';

export interface SessionPayload {
  sub: string;
  userId: string;
}

let _publicKey: CryptoKey | null = null;

async function getPublicKey(): Promise<CryptoKey> {
  if (_publicKey) return _publicKey;
  const { publicKey } = await loadOrCreateKeyPair();
  _publicKey = publicKey;
  return _publicKey;
}

export async function getSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ['ES256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
