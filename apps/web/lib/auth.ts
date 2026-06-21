import { loadOrCreateKeyPair } from '@wolfkrow/infra';
import { jwtVerify } from 'jose';

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
