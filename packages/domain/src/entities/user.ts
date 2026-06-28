import type { LockoutPolicy } from '../services/lockout-policy';
import type { PasswordHash } from '../value-objects/password-hash';

export type UserRole = 'owner';

export interface UserProps {
  id: string;
  passwordHash: PasswordHash;
  email: string | undefined;
  displayName: string | undefined;
  role: UserRole | undefined;
  totpEnabled: boolean | undefined;
  totpSecret: string | undefined;
  failedAttempts: number | undefined;
  lockedUntil: string | undefined;
  lastLogin: string | undefined;
}

/**
 * Usuário (single-user app — owner). Imutável: mutações (lockout, login, TOTP)
 * retornam novo User via fromProps. Comportamento de domínio vive aqui, não no
 * use-case nem no repo. Campos `T | undefined` (não `?`) por exactOptionalPropertyTypes.
 */
export class User {
  readonly id: string;
  readonly passwordHash: PasswordHash;
  readonly email: string | undefined;
  readonly displayName: string | undefined;
  readonly role: UserRole;
  readonly totpEnabled: boolean;
  readonly totpSecret: string | undefined;
  readonly failedAttempts: number;
  readonly lockedUntil: string | undefined;
  readonly lastLogin: string | undefined;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.passwordHash = props.passwordHash;
    this.email = props.email;
    this.displayName = props.displayName;
    this.role = props.role ?? 'owner';
    this.totpEnabled = props.totpEnabled ?? false;
    this.totpSecret = props.totpSecret;
    this.failedAttempts = props.failedAttempts ?? 0;
    this.lockedUntil = props.lockedUntil;
    this.lastLogin = props.lastLogin;
  }

  static fromProps(props: UserProps): User {
    return new User(props);
  }

  toProps(): UserProps {
    return {
      id: this.id,
      passwordHash: this.passwordHash,
      email: this.email,
      displayName: this.displayName,
      role: this.role,
      totpEnabled: this.totpEnabled,
      totpSecret: this.totpSecret,
      failedAttempts: this.failedAttempts,
      lockedUntil: this.lockedUntil,
      lastLogin: this.lastLogin,
    };
  }

  isLocked(now: Date = new Date()): boolean {
    return this.lockedUntil !== undefined && new Date(this.lockedUntil) > now;
  }

  recordFailedAttempt(policy: LockoutPolicy, now: Date = new Date()): User {
    const attempts = this.failedAttempts + 1;
    const lockedUntil = policy.shouldLock(attempts) ? policy.lockUntil(now) : this.lockedUntil;
    return User.fromProps({ ...this.toProps(), failedAttempts: attempts, lockedUntil });
  }

  recordSuccessfulLogin(now: Date = new Date()): User {
    return User.fromProps({
      ...this.toProps(),
      failedAttempts: 0,
      lockedUntil: undefined,
      lastLogin: now.toISOString(),
    });
  }

  enableTotp(secret: string): User {
    return User.fromProps({ ...this.toProps(), totpEnabled: true, totpSecret: secret });
  }

  disableTotp(): User {
    return User.fromProps({ ...this.toProps(), totpEnabled: false, totpSecret: undefined });
  }
}
