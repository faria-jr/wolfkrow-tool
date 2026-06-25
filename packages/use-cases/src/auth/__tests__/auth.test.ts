import type {
  User} from '@wolfkrow/domain';
import {
  ConflictError,
  type LockoutPolicy,
  LockoutPolicy as LockoutPolicyCtor,
  type PasswordHasher,
  PasswordHash,
  PlainPassword,
  type TotpVerifier,
  UnauthorizedError,
  type UserRepo,
} from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import {
  DisableTotpUseCase,
  EnableTotpUseCase,
  LoginUseCase,
  RegisterUseCase,
  SetupTotpUseCase,
  UnlockSessionUseCase,
  VerifyTotpUseCase,
} from '../index';

class InMemoryUserRepo implements UserRepo {
  private readonly users = new Map<string, User>();

  async findOwner(): Promise<User | null> {
    return this.users.values().next().value ?? null;
  }
  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

class FakeHasher implements PasswordHasher {
  private hashFor(plain: string): string {
    return `$2b$12$${plain.padEnd(53, 'x').slice(0, 53)}`;
  }
  async hash(plain: PlainPassword): Promise<PasswordHash> {
    return PasswordHash.create(this.hashFor(plain.value));
  }
  async verify(plain: PlainPassword, hash: PasswordHash): Promise<boolean> {
    return hash.value === this.hashFor(plain.value);
  }
}

const PW = (v: string) => PlainPassword.create(v);
const setup = () => {
  const repo = new InMemoryUserRepo();
  const hasher = new FakeHasher();
  const register = new RegisterUseCase(repo, hasher);
  const login = (policy: LockoutPolicy = new LockoutPolicyCtor()) =>
    new LoginUseCase(repo, hasher, policy);
  return { repo, hasher, register, login };
};

describe('RegisterUseCase', () => {
  it('creates the owner and persists', async () => {
    const { repo, register } = setup();
    const out = await register.execute({
      password: PW('Abcdef12'),
      displayName: 'Wolf',
      email: undefined,
    });
    expect(out.userId).toMatch(/^[0-9a-f-]{36}$/);
    const owner = await repo.findOwner();
    expect(owner).not.toBeNull();
    expect(owner?.id).toBe(out.userId);
  });

  it('refuses a second owner (ConflictError)', async () => {
    const { register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    await expect(
      register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('LoginUseCase', () => {
  it('succeeds with the correct password', async () => {
    const { register, login } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });

    const result = await login().execute({ password: PW('Abcdef12') });
    expect(result.status).toBe('success');
  });

  it('throws UnauthorizedError on wrong password before lockout', async () => {
    const { register, login } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });

    await expect(login().execute({ password: PW('Wrong123') })).rejects.toThrow(UnauthorizedError);
  });

  it('locks after max failed attempts', async () => {
    const { register, login } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });

    const l = login(new LockoutPolicyCtor(2));
    await expect(l.execute({ password: PW('Wrong123') })).rejects.toThrow(UnauthorizedError);
    const result = await l.execute({ password: PW('Wrong123') });
    expect(result.status).toBe('locked');
  });

  it('returns locked when user is already locked', async () => {
    const { repo, register, login } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.recordFailedAttempt(new LockoutPolicyCtor(1)));

    const result = await login().execute({ password: PW('Abcdef12') });
    expect(result.status).toBe('locked');
  });

  it('returns requires_totp when TOTP enabled', async () => {
    const { repo, register, login } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.enableTotp('SECRET'));

    const result = await login().execute({ password: PW('Abcdef12') });
    expect(result.status).toBe('requires_totp');
  });

  it('throws when no owner registered', async () => {
    const { login } = setup();
    await expect(login().execute({ password: PW('Abcdef12') })).rejects.toThrow(UnauthorizedError);
  });
});

const VALID_CODE = '123456';

class FakeTotp implements TotpVerifier {
  verify(_secret: string, code: string): boolean {
    return code === VALID_CODE;
  }
  generateSecret(account: string) {
    return { secret: 'S', otpauthUrl: `otpauth://totp/Wolfkrow:${account}` };
  }
}

describe('UnlockSessionUseCase', () => {
  it('succeeds with correct password', async () => {
    const { repo, hasher, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const out = await new UnlockSessionUseCase(repo, hasher, new LockoutPolicyCtor()).execute({ password: PW('Abcdef12') });
    expect(out.userId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('throws on wrong password', async () => {
    const { repo, hasher, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    await expect(
      new UnlockSessionUseCase(repo, hasher, new LockoutPolicyCtor()).execute({ password: PW('Wrong123') }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws when no owner', async () => {
    const { repo, hasher } = setup();
    await expect(
      new UnlockSessionUseCase(repo, hasher, new LockoutPolicyCtor()).execute({ password: PW('Abcdef12') }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('SetupTotpUseCase', () => {
  it('returns secret and otpauthUrl', async () => {
    const { repo, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    const out = await new SetupTotpUseCase(repo, new FakeTotp()).execute({ userId: owner!.id });
    expect(out.secret).toEqual(expect.any(String));
    expect(out.secret.length).toBeGreaterThan(0);
    expect(out.otpauthUrl).toContain('otpauth://');
  });
});

describe('EnableTotpUseCase', () => {
  it('enables TOTP with valid code', async () => {
    const { repo, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await new EnableTotpUseCase(repo, new FakeTotp()).execute({ userId: owner!.id, secret: 'S', code: VALID_CODE });
    const updated = await repo.findById(owner!.id);
    expect(updated?.totpEnabled).toBe(true);
  });

  it('throws on invalid code', async () => {
    const { repo, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await expect(
      new EnableTotpUseCase(repo, new FakeTotp()).execute({ userId: owner!.id, secret: 'S', code: '000000' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('DisableTotpUseCase', () => {
  it('disables TOTP with valid password and code', async () => {
    const { repo, hasher, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.enableTotp('SECRET'));
    await new DisableTotpUseCase(repo, hasher, new FakeTotp(), new LockoutPolicyCtor()).execute({
      userId: owner!.id,
      password: PW('Abcdef12'),
      code: VALID_CODE,
    });
    const updated = await repo.findById(owner!.id);
    expect(updated?.totpEnabled).toBe(false);
  });

  it('throws on wrong password', async () => {
    const { repo, hasher, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.enableTotp('SECRET'));
    await expect(
      new DisableTotpUseCase(repo, hasher, new FakeTotp(), new LockoutPolicyCtor()).execute({
        userId: owner!.id,
        password: PW('Wrong123'),
        code: VALID_CODE,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws on invalid TOTP code when TOTP enabled', async () => {
    const { repo, hasher, register } = setup();
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.enableTotp('SECRET'));
    await expect(
      new DisableTotpUseCase(repo, hasher, new FakeTotp(), new LockoutPolicyCtor()).execute({
        userId: owner!.id,
        password: PW('Abcdef12'),
        code: '000000',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('VerifyTotpUseCase', () => {
  async function registerAndEnableTotp(repo: UserRepo): Promise<string> {
    const register = new RegisterUseCase(repo, new FakeHasher());
    await register.execute({ password: PW('Abcdef12'), displayName: undefined, email: undefined });
    const owner = await repo.findOwner();
    await repo.save(owner!.enableTotp('SECRET'));
    return owner!.id;
  }

  it('succeeds with the correct code', async () => {
    const { repo } = setup();
    const userId = await registerAndEnableTotp(repo);

    const out = await new VerifyTotpUseCase(repo, new FakeTotp()).execute({
      userId,
      code: VALID_CODE,
    });
    expect(out.userId).toBe(userId);
  });

  it('throws on invalid code', async () => {
    const { repo } = setup();
    const userId = await registerAndEnableTotp(repo);

    await expect(
      new VerifyTotpUseCase(repo, new FakeTotp()).execute({ userId, code: '000000' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws when TOTP not enabled', async () => {
    const { repo } = setup();
    await new RegisterUseCase(repo, new FakeHasher()).execute({
      password: PW('Abcdef12'),
      displayName: undefined,
      email: undefined,
    });
    const owner = await repo.findOwner();

    await expect(
      new VerifyTotpUseCase(repo, new FakeTotp()).execute({ userId: owner!.id, code: VALID_CODE }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
