import { Secret } from '@wolfkrow/domain';
import type { SecretCategory, SecretRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { secretsMetadata } from '../db/schema';

export class DrizzleSecretRepo implements SecretRepo {
  constructor(private readonly db = getDb()) {}

  async findAll(userId: string): Promise<Secret[]> {
    const rows = this.db
      .select()
      .from(secretsMetadata)
      .where(eq(secretsMetadata.userId, userId))
      .all();

    return rows.map((r) =>
      Secret.fromProps({
        id: r.id,
        userId: r.userId,
        key: r.key,
        displayName: r.displayName,
        description: r.description ?? undefined,
        category: r.category as SecretCategory,
        lastAccessed: r.lastAccessed ?? undefined,
        lastRotated: r.lastRotated ?? undefined,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async findByKey(key: string): Promise<Secret | null> {
    const row = this.db
      .select()
      .from(secretsMetadata)
      .where(eq(secretsMetadata.key, key))
      .get();

    if (!row) return null;
    return Secret.fromProps({
      id: row.id,
      userId: row.userId,
      key: row.key,
      displayName: row.displayName,
      description: row.description ?? undefined,
      category: row.category as SecretCategory,
      lastAccessed: row.lastAccessed ?? undefined,
      lastRotated: row.lastRotated ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(secret: Secret): Promise<Secret> {
    const p = secret.toProps();
    this.db
      .insert(secretsMetadata)
      .values({
        id: p.id,
        userId: p.userId,
        key: p.key,
        displayName: p.displayName,
        description: p.description ?? null,
        category: p.category,
        lastAccessed: p.lastAccessed ?? null,
        lastRotated: p.lastRotated ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
      .onConflictDoUpdate({
        target: secretsMetadata.id,
        set: {
          displayName: p.displayName,
          description: p.description ?? null,
          category: p.category,
          lastAccessed: p.lastAccessed ?? null,
          lastRotated: p.lastRotated ?? null,
          updatedAt: p.updatedAt,
        },
      })
      .run();
    return secret;
  }

  async delete(key: string): Promise<void> {
    this.db.delete(secretsMetadata).where(eq(secretsMetadata.key, key)).run();
  }
}
