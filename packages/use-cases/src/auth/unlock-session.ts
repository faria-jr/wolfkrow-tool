import type { LockoutPolicy, PasswordHasher, PlainPassword, UserRepo } from '@wolfkrow/domain';
import { UnauthorizedError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface UnlockSessionInput {
  password: PlainPassword;
}

export interface UnlockSessionOutput {
  userId: string;
}

/** Re-verifica senha na tela de lock e registra login bem-sucedido. */
export class UnlockSessionUseCase implements UseCase<UnlockSessionInput, UnlockSessionOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly hasher: PasswordHasher,
    private readonly lockout: LockoutPolicy
  ) {}

  async execute(input: UnlockSessionInput): Promise<UnlockSessionOutput> {
    const user = await this.userRepo.findOwner();
    if (!user) throw new UnauthorizedError('No owner account registered');
    if (user.isLocked()) throw new UnauthorizedError('Account is locked');

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      const updated = user.recordFailedAttempt(this.lockout);
      await this.userRepo.save(updated);
      throw new UnauthorizedError('Invalid password');
    }

    await this.userRepo.save(user.recordSuccessfulLogin());
    return { userId: user.id };
  }
}
