import type { TotpVerifier, UserRepo } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface SetupTotpInput {
  userId: string;
}

export interface SetupTotpOutput {
  secret: string;
  otpauthUrl: string;
}

/** Gera secret + URL otpauth para exibir QR code. NÃO ativa TOTP ainda. */
export class SetupTotpUseCase implements UseCase<SetupTotpInput, SetupTotpOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly totp: TotpVerifier
  ) {}

  async execute(input: SetupTotpInput): Promise<SetupTotpOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new NotFoundError('User', input.userId);
    const { secret, otpauthUrl } = this.totp.generateSecret(user.email ?? 'owner');
    return { secret, otpauthUrl };
  }
}
