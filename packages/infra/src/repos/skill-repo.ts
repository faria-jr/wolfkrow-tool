import { Skill, type SkillRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { skills } from '../db/schema/skills';

type SkillRow = typeof skills.$inferSelect;
type Db = ReturnType<typeof getDb>;

export class DrizzleSkillRepo implements SkillRepo {
  constructor(private readonly db: Db = getDb()) {}

  async findById(id: string): Promise<Skill | null> {
    const rows = this.db.select().from(skills).where(eq(skills.id, id)).limit(1).all();
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Skill[]> {
    const rows = this.db.select().from(skills).where(eq(skills.userId, userId)).all();
    return rows.map((r) => this.toEntity(r));
  }

  async findBuiltIn(): Promise<Skill[]> {
    const rows = this.db.select().from(skills).where(eq(skills.isBuiltIn, true)).all();
    return rows.map((r) => this.toEntity(r));
  }

  async findByName(userId: string, name: string): Promise<Skill | null> {
    const rows = this.db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId))
      .all()
      .filter((r) => r.name === name);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async save(skill: Skill): Promise<Skill> {
    const now = new Date();
    const row = this.toInsertRow(skill, now);
    const updateSet = this.toUpdateSet(skill, now);
    this.db
      .insert(skills)
      .values(row)
      .onConflictDoUpdate({ target: skills.id, set: updateSet })
      .run();
    return skill;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(skills).where(eq(skills.id, id)).run();
  }

  private toInsertRow(skill: Skill, now: Date) {
    return {
      id: skill.id,
      userId: skill.userId,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      tags: [...skill.tags],
      version: skill.version,
      isBuiltIn: skill.isBuiltIn,
      metadata: {} as Record<string, unknown>,
      createdAt: skill.createdAt,
      updatedAt: now,
      ...(skill.author !== undefined ? { author: skill.author } : {}),
    };
  }

  private toUpdateSet(skill: Skill, now: Date) {
    return {
      name: skill.name,
      description: skill.description,
      content: skill.content,
      tags: [...skill.tags],
      version: skill.version,
      isBuiltIn: skill.isBuiltIn,
      updatedAt: now,
      ...(skill.author !== undefined ? { author: skill.author } : {}),
    };
  }

  private toEntity(row: SkillRow): Skill {
    return Skill.fromProps({
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      content: row.content,
      tags: Array.isArray(row.tags) ? row.tags : [],
      version: row.version,
      author: row.author ?? undefined,
      isBuiltIn: row.isBuiltIn,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
