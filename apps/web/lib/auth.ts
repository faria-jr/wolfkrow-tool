import { loadOrCreateKeyPair } from '@wolfkrow/infra';
import { createRepoRegistry } from '@wolfkrow/infra/repos';
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

let _ownerUserId: string | null = null;

/**
 * Returns the owner's userId for shared-workspace resource queries.
 * Cached after first DB lookup.
 */
async function resolveOwnerUserId(): Promise<string | null> {
  if (_ownerUserId) return _ownerUserId;
  try {
    const repo = createRepoRegistry().user;
    const owner = await repo.findOwner();
    _ownerUserId = owner?.id ?? null;
  } catch {
    _ownerUserId = null;
  }
  return _ownerUserId;
}

/**
 * Resolves the JWT cookie and returns the session payload.
 *
 * Shared workspace mode (WOLFKROW_SHARED_WORKSPACE !== 'false', default on):
 * the returned `userId` is always the owner's userId regardless of which
 * authenticated user made the request. This allows all users to read/write
 * shared resources without per-user scoping, while the `sub` field retains
 * the real caller's identity for audit purposes.
 */
export async function getSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ['ES256'] });
    const raw = payload as unknown as SessionPayload;

    const sharedWorkspace = process.env['WOLFKROW_SHARED_WORKSPACE'] !== 'false';
    if (sharedWorkspace) {
      const ownerId = await resolveOwnerUserId();
      if (ownerId) return { ...raw, userId: ownerId };
    }

    return raw;
  } catch {
    return null;
  }
}
