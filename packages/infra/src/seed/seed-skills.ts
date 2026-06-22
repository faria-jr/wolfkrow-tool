import { Skill } from '@wolfkrow/domain';
import { eq, and } from 'drizzle-orm';

import { getDb } from '../db/client';
import { skills } from '../db/schema/skills';

import { BUILT_IN_SKILLS } from './built-in-skills';

const SYSTEM_USER_ID = 'system';

export async function seedBuiltInSkills(): Promise<void> {
  const db = getDb();

  for (const def of BUILT_IN_SKILLS) {
    const existing = db
      .select()
      .from(skills)
      .where(and(eq(skills.name, def.name), eq(skills.isBuiltIn, true)))
      .limit(1)
      .all();

    if (existing.length > 0) continue;

    const skill = Skill.create({
      userId: SYSTEM_USER_ID,
      name: def.name,
      description: def.description,
      content: def.content,
      tags: [...def.tags],
      isBuiltIn: true,
      version: def.version,
    });

    db.insert(skills).values({
      id: skill.id,
      userId: skill.userId,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      tags: [...skill.tags],
      version: skill.version,
      isBuiltIn: skill.isBuiltIn,
      metadata: {},
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    }).run();
  }
}
