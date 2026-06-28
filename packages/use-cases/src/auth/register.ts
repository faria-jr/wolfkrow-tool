import type { PlainPassword } from '@wolfkrow/domain';
import { ConflictError, Id, type PasswordHasher, type UserRepo, User } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface RegisterInput {
  password: PlainPassword;
  displayName: string | undefined;
  email: string | undefined;
}

export interface RegisterOutput {
  userId: string;
}

/** Setup wizard: cria o owner (single-user). Falha se já existe. */
export class RegisterUseCase implements UseCase<RegisterInput, RegisterOutput> {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findOwner();
    if (existing) {
      throw new ConflictError('Owner account already exists');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = User.fromProps({
      id: Id.generate().value,
      passwordHash,
      email: input.email,
      displayName: input.displayName,
      role: undefined,
      totpEnabled: undefined,
      totpSecret: undefined,
      failedAttempts: undefined,
      lockedUntil: undefined,
      lastLogin: undefined,
    });

    await this.userRepo.save(user);
    return { userId: user.id };
  }
}
