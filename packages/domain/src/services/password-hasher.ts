import type { PasswordHash } from '../value-objects/password-hash';
import type { PlainPassword } from '../value-objects/plain-password';

/**
 * Port de hash de senha. Infra implementa (bcrypt); testes usam fake.
 * Domínio nunca conhece bcrypt — só o contrato.
 */
export interface PasswordHasher {
  hash(plain: PlainPassword): Promise<PasswordHash>;
  verify(plain: PlainPassword, hash: PasswordHash): Promise<boolean>;
}
