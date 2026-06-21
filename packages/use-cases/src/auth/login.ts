import type {
  PlainPassword} from '@wolfkrow/domain';
import {
  type LockoutPolicy,
  type PasswordHasher,
  UnauthorizedError,
  type User,
  type UserRepo,
} from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface LoginInput {
  password: PlainPassword;
}

export type LoginOutput =
  | { status: 'success'; userId: string }
  | { status: 'requires_totp'; userId: string }
  | { status: 'locked'; lockedUntil: string };

/**
 * Login do owner. Fluxo: locked? → invalid password (registra falha/lockout) →
 * totpEnabled? → success. Senha verificada contra hash via port PasswordHasher.
 */
export class LoginUseCase implements UseCase<LoginInput, LoginOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly hasher: PasswordHasher,
    private readonly lockout: LockoutPolicy,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findOwner();
    if (!user) {
      throw new UnauthorizedError('No owner account registered');
    }

    if (user.isLocked()) {
      return { status: 'locked', lockedUntil: user.lockedUntil ?? '' };
    }

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      return this.handleFailedAttempt(user);
    }

    if (user.totpEnabled) {
      return { status: 'requires_totp', userId: user.id };
    }

    await this.userRepo.save(user.recordSuccessfulLogin());
    return { status: 'success', userId: user.id };
  }

  private async handleFailedAttempt(user: User): Promise<LoginOutput> {
    const updated = user.recordFailedAttempt(this.lockout);
    await this.userRepo.save(updated);
    if (updated.isLocked()) {
      return { status: 'locked', lockedUntil: updated.lockedUntil ?? '' };
    }
    throw new UnauthorizedError('Invalid password');
  }
}
