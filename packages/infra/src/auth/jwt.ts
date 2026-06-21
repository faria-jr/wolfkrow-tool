/**
 * Shared JWT utilities for web/worker authentication
 */

import {
  SignJWT,
  jwtVerify,
  exportJWK,
  importJWK,
  createLocalJWKSet,
  createRemoteJWKSet,
  type JWK,
} from 'jose';

export interface AuthTokenPayload {
  sub: string;
  userId: string;
  role?: string;
}

export async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  ) as Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }>;
}

export async function exportPublicJwk(publicKey: CryptoKey): Promise<JWK> {
  return exportJWK(publicKey);
}

export async function createToken(
  payload: AuthTokenPayload,
  privateKey: CryptoKey,
  issuer = 'wolfkrow'
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience('wolfkrow-worker')
    .setExpirationTime('24h')
    .setSubject(payload.sub)
    .sign(privateKey);
}

export async function verifyToken(
  token: string,
  publicKey: CryptoKey,
  issuer = 'wolfkrow'
): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, await createLocalJWKSet({ keys: [await exportJWK(publicKey)] }), {
    issuer,
    audience: 'wolfkrow-worker',
  });
  return {
    sub: payload.sub as string,
    userId: payload.userId as string,
    ...(payload.role !== undefined && { role: payload.role as string }),
  };
}

export { createLocalJWKSet, createRemoteJWKSet, importJWK };
