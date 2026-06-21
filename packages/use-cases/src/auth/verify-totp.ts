import {
  NotFoundError,
  type TotpVerifier,
  UnauthorizedError,
  type UserRepo,
} from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface VerifyTotpInput {
  userId: string;
  code: string;
}

export interface VerifyTotpOutput {
  userId: string;
}

/** Verifica o 2º fator (TOTP) e completa o login (registra success). */
export class VerifyTotpUseCase implements UseCase<VerifyTotpInput, VerifyTotpOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly totp: TotpVerifier,
  ) {}

  async execute(input: VerifyTotpInput): Promise<VerifyTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundError('User', input.userId);
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedError('TOTP not enabled for this account');
    }
    if (!this.totp.verify(user.totpSecret, input.code)) {
      throw new UnauthorizedError('Invalid TOTP code');
    }

    await this.userRepo.save(user.recordSuccessfulLogin());
    return { userId: user.id };
  }
}
