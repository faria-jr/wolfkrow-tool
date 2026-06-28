import type { PlainPassword } from '@wolfkrow/domain';
import { PasswordHash, type PasswordHasher } from '@wolfkrow/domain';
import bcrypt from 'bcryptjs';

/**
 * PasswordHasher via bcrypt (bcryptjs — pure JS, sem binding nativo; adequado
 * ao desktop single-user). Implementa o port do domínio.
 */
export class BcryptHasher implements PasswordHasher {
  constructor(private readonly rounds = 12) {}

  async hash(plain: PlainPassword): Promise<PasswordHash> {
    const hash = await bcrypt.hash(plain.value, this.rounds);
    return PasswordHash.create(hash);
  }

  async verify(plain: PlainPassword, hash: PasswordHash): Promise<boolean> {
    return bcrypt.compare(plain.value, hash.value);
  }
}
