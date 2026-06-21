import { PasswordHash, User, type UserRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';


import { getDb } from '../db/client';
import { users } from '../db/schema/auth';

type UserRow = typeof users.$inferSelect;

/**
 * UserRepo via Drizzle (SQLite). Single-user app → findOwner() = primeiro user.
 * save() upsert preservando createdAt (apenas updatedAt muda em update).
 */
export class DrizzleUserRepo implements UserRepo {
  constructor(private readonly db = getDb()) {}

  async findOwner(): Promise<User | null> {
    const rows = this.db.select().from(users).limit(1).all();
    return rows[0] ? this.toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const rows = this.db.select().from(users).where(eq(users.id, id)).limit(1).all();
    return rows[0] ? this.toUser(rows[0]) : null;
  }

  async save(user: User): Promise<User> {
    const now = new Date();
    this.db
      .insert(users)
      .values(this.insertValues(user, now))
      .onConflictDoUpdate({ target: users.id, set: this.updateSet(user, now) })
      .run();
    return user;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(users).where(eq(users.id, id)).run();
  }

  private toUser(row: UserRow): User {
    return User.fromProps({
      id: row.id,
      passwordHash: PasswordHash.create(row.passwordHash),
      email: row.email ?? undefined,
      displayName: row.displayName ?? undefined,
      role: row.role,
      totpEnabled: row.totpEnabled,
      totpSecret: row.totpSecret ?? undefined,
      failedAttempts: row.failedAttempts,
      lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString() : undefined,
      lastLogin: row.lastLogin ? row.lastLogin.toISOString() : undefined,
    });
  }

  private insertValues(user: User, now: Date) {
    return {
      id: user.id,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      passwordHash: user.passwordHash.value,
      role: user.role,
      totpEnabled: user.totpEnabled,
      totpSecret: user.totpSecret ?? null,
      failedAttempts: user.failedAttempts,
      lockedUntil: user.lockedUntil ? new Date(user.lockedUntil) : null,
      lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  private updateSet(user: User, now: Date) {
    const { createdAt: _createdAt, ...rest } = this.insertValues(user, now);
    void _createdAt;
    return { ...rest, updatedAt: now };
  }
}
