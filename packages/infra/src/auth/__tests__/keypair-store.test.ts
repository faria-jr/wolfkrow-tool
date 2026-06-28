import { exportJWK } from 'jose';
import keytar from 'keytar';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateKeyPair } from '../jwt';
import { loadOrCreateKeyPair } from '../keypair-store';

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
  },
}));

describe('loadOrCreateKeyPair', () => {
  beforeEach(() => {
    vi.mocked(keytar.getPassword).mockReset();
    vi.mocked(keytar.setPassword).mockReset();
  });

  it('generates and persists on first call (no stored key)', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue(null);

    const pair = await loadOrCreateKeyPair('test-svc', 'jwt');

    expect(pair.publicKey).toBeInstanceOf(CryptoKey);
    expect(pair.privateKey).toBeInstanceOf(CryptoKey);
    expect(pair.publicJwk.kty).toBe('EC');
    expect(keytar.setPassword).toHaveBeenCalledOnce();
  });

  it('hydrates a stored pair without regenerating', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const publicJwk = await exportJWK(publicKey);
    const privateJwk = await exportJWK(privateKey);
    vi.mocked(keytar.getPassword).mockResolvedValue(JSON.stringify({ publicJwk, privateJwk }));

    const pair = await loadOrCreateKeyPair('test-svc', 'jwt');

    expect(pair.publicJwk).toEqual(publicJwk);
    expect(keytar.setPassword).not.toHaveBeenCalled();
  });

  it('throws on corrupted stored pair', async () => {
    vi.mocked(keytar.getPassword).mockResolvedValue('{ not valid json');

    await expect(loadOrCreateKeyPair('test-svc', 'jwt')).rejects.toThrow();
  });
});
