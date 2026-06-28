import type {
  LockoutPolicy,
  PasswordHasher,
  PlainPassword,
  TotpVerifier,
  UserRepo,
} from '@wolfkrow/domain';
import { NotFoundError, UnauthorizedError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DisableTotpInput {
  userId: string;
  password: PlainPassword;
  code: string | undefined;
}

export interface DisableTotpOutput {
  userId: string;
}

/** Desativa TOTP: verifica senha (e código se TOTP ainda ativo) antes de remover. */
export class DisableTotpUseCase implements UseCase<DisableTotpInput, DisableTotpOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly hasher: PasswordHasher,
    private readonly totp: TotpVerifier,
    private readonly lockout: LockoutPolicy
  ) {}

  async execute(input: DisableTotpInput): Promise<DisableTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new NotFoundError('User', input.userId);

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      const updated = user.recordFailedAttempt(this.lockout);
      await this.userRepo.save(updated);
      throw new UnauthorizedError('Invalid password');
    }

    if (user.totpEnabled && user.totpSecret) {
      if (!input.code || !this.totp.verify(user.totpSecret, input.code)) {
        throw new UnauthorizedError('Valid TOTP code required to disable 2FA');
      }
    }

    await this.userRepo.save(user.disableTotp());
    return { userId: user.id };
  }
}
