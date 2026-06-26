import { Skill } from '@wolfkrow/domain';
import type { SkillRepo } from '@wolfkrow/domain';
import { loadBuiltInSkills } from '@wolfkrow/infra/seed/skill-loader';

import { createLogger } from '../logger';

const logger = createLogger('seed:skills');

/**
 * Idempotent: seeds built-in skills only when the DB has zero built-in skills.
 * Safe to call on every restart — user-edited or user-created skills are never
 * touched because this gate checks `isBuiltIn` globally (not per-user).
 */
export async function ensureBuiltInSkills(repo: SkillRepo, userId: string): Promise<number> {
  const existing = await repo.findBuiltIn();
  if (existing.length > 0) return 0;

  const loaded = await loadBuiltInSkills();
  let inserted = 0;

  for (const { skill } of loaded) {
    const props = skill.toProps();
    const owned = Skill.fromProps({ ...props, userId, isBuiltIn: true });
    await repo.save(owned);
    inserted += 1;
  }

  if (inserted > 0) {
    logger.info({ userId, count: inserted }, 'Seeded built-in skills');
  }
  return inserted;
}
