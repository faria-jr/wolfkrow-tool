import { randomUUID } from 'node:crypto';

import { getDb } from '@wolfkrow/infra/db/client';
import { channels } from '@wolfkrow/infra/db/schema';
import { eq } from 'drizzle-orm';

import { createLogger } from '../logger';

const logger = createLogger('seed:channels');

const CHANNEL_TYPES: Array<'telegram' | 'discord' | 'slack' | 'whatsapp'> = [
  'telegram',
  'discord',
  'slack',
  'whatsapp',
];

/**
 * Idempotent: seeds channel placeholder rows only when user has zero channel rows.
 * The placeholder rows allow the Channels page to list all supported channels
 * with their status (connected/disconnected) without requiring them to be active.
 */
export async function ensureBuiltInChannels(userId: string): Promise<number> {
  const db = getDb();
  const existing = db.select().from(channels).where(eq(channels.userId, userId)).all();
  if (existing.length > 0) return 0;

  const now = new Date();
  let inserted = 0;

  for (const type of CHANNEL_TYPES) {
    db.insert(channels)
      .values({
        id: randomUUID(),
        userId,
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        enabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    inserted += 1;
  }

  if (inserted > 0) {
    logger.info({ userId, count: inserted }, 'Seeded channel placeholders');
  }
  return inserted;
}
