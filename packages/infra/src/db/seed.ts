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
import { loadBuiltInSkills } from '../seed/skill-loader';

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

type Db = ReturnType<typeof getDb>;
type UserRow = typeof users.$inferSelect;

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

async function createDefaultUser(db: Db, options: SeedOptions): Promise<UserRow> {
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
  return defaultUser;
}

async function insertDefaultSettings(db: Db, userId: string): Promise<void> {
  await db.insert(settings).values({
    id: generateId(),
    userId,
    updatedAt: now(),
  });
}

async function seedSkills(db: Db, userId: string): Promise<number> {
  const loadedSkills = await loadBuiltInSkills();
  for (const { skill } of loadedSkills) {
    const row: typeof skills.$inferInsert = {
      id: generateId(),
      userId,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      tags: [...skill.tags],
      version: skill.version,
      isBuiltIn: true,
      createdAt: now(),
      updatedAt: now(),
    };
    if (skill.author !== undefined) row.author = skill.author;
    await db.insert(skills).values(row);
  }
  return loadedSkills.length;
}

async function seedMcpServers(db: Db, userId: string): Promise<number> {
  for (const mcp of BUILT_IN_MCP_SERVERS) {
    await db.insert(mcpServers).values({
      id: generateId(),
      ...mcp,
      userId,
      isBuiltIn: true,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  return BUILT_IN_MCP_SERVERS.length;
}

async function seedChannels(db: Db, userId: string): Promise<number> {
  const channelTypes: Array<'telegram' | 'discord' | 'slack' | 'whatsapp'> = [
    'telegram',
    'discord',
    'slack',
    'whatsapp',
  ];
  for (const type of channelTypes) {
    await db.insert(channels).values({
      id: generateId(),
      userId,
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      enabled: false,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  return channelTypes.length;
}

async function insertDefaultSecrets(db: Db, userId: string): Promise<void> {
  await db.insert(secretsMetadata).values({
    id: generateId(),
    userId,
    key: 'anthropic-api-key',
    displayName: 'Anthropic API Key',
    description: 'API key for Claude models',
    category: 'ai',
    createdAt: now(),
    updatedAt: now(),
  });
}

async function isAlreadySeeded(db: Db): Promise<boolean> {
  const existingUsers = await db.select().from(users).limit(1);
  return existingUsers.length > 0;
}

export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const db = getDb();

  logger.info('Seeding database...');

  try {
    if (await isAlreadySeeded(db)) {
      logger.info('Database already seeded, skipping');
      return;
    }

    const defaultUser = await createDefaultUser(db, options);
    logger.info({ userId: defaultUser.id }, 'Created default user');

    await insertDefaultSettings(db, defaultUser.id);
    logger.info('Created default settings');

    const skillsCount = await seedSkills(db, defaultUser.id);
    logger.info({ count: skillsCount }, 'Inserted built-in skills');

    const mcpCount = await seedMcpServers(db, defaultUser.id);
    logger.info({ count: mcpCount }, 'Inserted built-in MCP servers');

    const channelCount = await seedChannels(db, defaultUser.id);
    logger.info({ count: channelCount }, 'Created channel placeholders');

    await insertDefaultSecrets(db, defaultUser.id);
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
