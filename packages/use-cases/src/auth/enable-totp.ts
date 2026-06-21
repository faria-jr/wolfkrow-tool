import type { TotpVerifier, UserRepo } from '@wolfkrow/domain';
import { NotFoundError, UnauthorizedError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface EnableTotpInput {
  userId: string;
  secret: string;
  code: string;
}

export interface EnableTotpOutput {
  userId: string;
}

/** Ativa TOTP: verifica o código antes de gravar. Secret vem de SetupTotpUseCase. */
export class EnableTotpUseCase implements UseCase<EnableTotpInput, EnableTotpOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly totp: TotpVerifier,
  ) {}

  async execute(input: EnableTotpInput): Promise<EnableTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new NotFoundError('User', input.userId);
    if (!this.totp.verify(input.secret, input.code)) {
      throw new UnauthorizedError('Invalid TOTP code');
    }
    await this.userRepo.save(user.enableTotp(input.secret));
    return { userId: user.id };
  }
}
