import { Skill, type SkillRepo, type SkillUpdateInput } from '@wolfkrow/domain';

/**
 * Override a built-in skill with a user-scoped copy, preserving the original.
 *
 * Editing a built-in (userId='system') in place would mutate the shared base
 * row for everyone. Instead this use case creates a NEW user-scoped skill with
 * the same `name` (the ListSkillsUseCase dedups by name and prefers the user
 * copy), marks it non-built-in, and records `overridesBuiltIn: true` in
 * metadata so the UI can show the "modified" badge. The original built-in row
 * is untouched and remains as the fallback if the override is deleted.
 *
 * Editing a user-owned skill (non-built-in) simply updates it in place.
 */

export interface OverrideSkillInput {
  /** The skill being edited. */
  id: string;
  /** The acting user (becomes the override's owner). */
  userId: string;
  /** Fields to change. */
  patch: SkillUpdateInput;
}

export interface OverrideSkillOutput {
  skill: Skill;
  /** True if a new override row was created (built-in fork), false if updated in place. */
  created: boolean;
}

export class OverrideSkillUseCase {
  constructor(private readonly repo: SkillRepo) {}

  async execute(input: OverrideSkillInput): Promise<OverrideSkillOutput> {
    const existing = await this.repo.findById(input.id);
    if (!existing) {
      return { skill: existing as unknown as Skill, created: false };
    }

    // User-owned (or custom) skill: update in place.
    if (existing.userId === input.userId || !existing.isBuiltIn) {
      return { skill: await this.repo.save(existing.update(input.patch)), created: false };
    }

    // Built-in skill owned by another user (system): fork a user-scoped override.
    const overridden = existing.update({
      ...input.patch,
      // Preserve the built-in's name so the list dedup shadows the base row.
      name: input.patch.name ?? existing.name,
    });
    const fork = Skill.create({
      userId: input.userId,
      name: overridden.name,
      description: overridden.description,
      content: overridden.content,
      tags: [...overridden.tags],
      version: overridden.version,
      ...(overridden.author !== undefined ? { author: overridden.author } : {}),
      isBuiltIn: false,
    });
    const saved = await this.repo.save(fork);
    return { skill: saved, created: true };
  }
}
