import { eq, and } from 'drizzle-orm';

import { getDb } from '../db/client';
import { skills } from '../db/schema/skills';

import { loadBuiltInSkills } from './skill-loader';

const SYSTEM_USER_ID = 'system';

export async function seedBuiltInSkills(): Promise<void> {
  const db = getDb();
  const loaded = await loadBuiltInSkills();

  for (const { skill } of loaded) {
    const existing = db
      .select()
      .from(skills)
      .where(and(eq(skills.name, skill.name), eq(skills.isBuiltIn, true)))
      .limit(1)
      .all();

    if (existing.length > 0) continue;

    const row: typeof skills.$inferInsert = {
      id: skill.id,
      userId: SYSTEM_USER_ID,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      tags: [...skill.tags],
      version: skill.version,
      isBuiltIn: true,
      metadata: {},
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
    if (skill.author !== undefined) row.author = skill.author;

    db.insert(skills).values(row).run();
  }
}
