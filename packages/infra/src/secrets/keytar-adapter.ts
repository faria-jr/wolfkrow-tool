import type { SecretsAdapter } from '@wolfkrow/domain';
import keytar from 'keytar';

const SERVICE = 'wolfkrow-tool';

export class KeytarSecretsAdapter implements SecretsAdapter {
  async get(key: string): Promise<string | null> {
    return keytar.getPassword(SERVICE, key);
  }

  async set(key: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE, key, value);
  }

  async delete(key: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE, key);
  }

  async list(): Promise<string[]> {
    const all = await keytar.findCredentials(SERVICE);
    return all.map((c) => c.account);
  }
}
