/**
 * Database seed
 *
 * Creates initial data:
 * - Default user (placeholder)
 * - Default settings
 * - Default skills (.wolfkrow/skills/*)
 * - 19 built-in MCP servers
 */

import { randomUUID } from 'node:crypto';

import { createLogger } from '../logger';
import { BUILT_IN_MCP_SERVERS } from '../seed/built-in-mcps';
import { BUILT_IN_SKILLS } from '../seed/built-in-skills';

import { getDb, closeDb } from './client';
import {
  channels,
  mcpServers,
  secretsMetadata,
  settings,
  skills,
  users,
} from './schema';

const logger = createLogger('db:seed');

export interface SeedOptions {
  userEmail?: string;
  userDisplayName?: string;
}

function generateId(): string {
  return randomUUID();
}

function now(): Date {
  return new Date();
}

export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const db = getDb();

  logger.info('Seeding database...');

  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      logger.info('Database already seeded, skipping');
      return;
    }

    const [defaultUser] = await db
      .insert(users)
      .values({
        id: generateId(),
        email: options.userEmail ?? '[email protected]',
        displayName: options.userDisplayName ?? 'Wolfkrow User',
        passwordHash: 'pending-setup',
        role: 'owner',
        createdAt: now(),
        updatedAt: now(),
      })
      .returning();
    if (!defaultUser) throw new Error('Failed to create default user');

    logger.info({ userId: defaultUser.id }, 'Created default user');

    await db.insert(settings).values({
      id: generateId(),
      userId: defaultUser.id,
      updatedAt: now(),
    });

    logger.info('Created default settings');

    for (const skill of BUILT_IN_SKILLS) {
      await db.insert(skills).values({
        id: generateId(),
        ...skill,
        userId: defaultUser.id,
        isBuiltIn: true,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    logger.info({ count: BUILT_IN_SKILLS.length }, 'Inserted built-in skills');

    for (const mcp of BUILT_IN_MCP_SERVERS) {
      await db.insert(mcpServers).values({
        id: generateId(),
        ...mcp,
        userId: defaultUser.id,
        isBuiltIn: true,
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    logger.info({ count: BUILT_IN_MCP_SERVERS.length }, 'Inserted built-in MCP servers');

    const channelTypes: Array<'telegram' | 'discord' | 'slack' | 'whatsapp'> = [
      'telegram',
      'discord',
      'slack',
      'whatsapp',
    ];
    for (const type of channelTypes) {
      await db.insert(channels).values({
        id: generateId(),
        userId: defaultUser.id,
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        enabled: false,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    logger.info({ count: channelTypes.length }, 'Created channel placeholders');

    await db.insert(secretsMetadata).values({
      id: generateId(),
      userId: defaultUser.id,
      key: 'anthropic-api-key',
      displayName: 'Anthropic API Key',
      description: 'API key for Claude models',
      category: 'ai',
      createdAt: now(),
      updatedAt: now(),
    });

    logger.info('Seed completed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Seed failed');
    throw error;
  } finally {
    closeDb();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch((error) => {
    logger.error({ err: error }, 'Unhandled seed error');
    process.exit(1);
  });
}
