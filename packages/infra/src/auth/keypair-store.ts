/**
 * Keypair JWT ES256 persistido em keytar (corrige B1/G2 — keypair efêmero em
 * memória invalidava todos os tokens a cada restart do web/worker).
 *
 * Web: carrega/cria no boot, assina tokens (private) e publica JWKS (public).
 * Worker: valida via endpoint JWKS (não precisa do keytar, só da public key).
 */

import { exportJWK, type JWK } from 'jose';
import keytar from 'keytar';


import { generateKeyPair, importJWK } from './jwt';

const SERVICE = 'wolfkrow';
const ACCOUNT = 'jwt-keypair';

export interface StoredKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicJwk: JWK;
}

interface SerializedPair {
  publicJwk: JWK;
  privateJwk: JWK;
}

/** Carrega o keypair do keychain; gera+persiste na 1ª vez. Idempotente. */
export async function loadOrCreateKeyPair(
  service = SERVICE,
  account = ACCOUNT,
): Promise<StoredKeyPair> {
  const stored = await keytar.getPassword(service, account);
  if (stored) {
    return hydrate(JSON.parse(stored) as SerializedPair);
  }
  return generateAndStore(service, account);
}

async function hydrate(parsed: SerializedPair): Promise<StoredKeyPair> {
  const publicKey = (await importJWK(parsed.publicJwk)) as CryptoKey | null;
  const privateKey = (await importJWK(parsed.privateJwk)) as CryptoKey | null;
  if (!publicKey || !privateKey) {
    throw new Error('Invalid stored JWT keypair in keychain');
  }
  return { publicKey, privateKey, publicJwk: parsed.publicJwk };
}

async function generateAndStore(
  service: string,
  account: string,
): Promise<StoredKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair();
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  await keytar.setPassword(service, account, JSON.stringify({ publicJwk, privateJwk }));
  return { publicKey, privateKey, publicJwk };
}
