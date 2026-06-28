import { Agent, type AgentRepo } from '@wolfkrow/domain';

import { loadSeedAgents } from './loader';
import type { SeedAgent } from './schema';

export { loadSeedAgents };
export type { SeedAgent };

/**
 * Deterministic, stable id for a seeded agent.
 * Combines the owner userId with the slugified agent name so the same
 * (userId, name) always maps to the same row across restarts — the basis
 * of idempotent seeding.
 */
export function seedAgentId(userId: string, name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${userId}::${slug}`;
}

/** Map a validated seed definition to an Agent entity owned by `userId`. */
function toAgent(def: SeedAgent, userId: string): Agent {
  return Agent.fromProps({
    id: seedAgentId(userId, def.name),
    userId,
    name: def.name,
    description: def.description,
    model: def.model,
    effort: def.effort,
    thinking: def.thinking,
    thinkingBudget: def.thinkingBudget,
    maxTurns: def.maxTurns,
    allowedTools: [...def.allowedTools],
    mcpServers: [...def.mcpServers],
    isActive: def.isActive,
    skills: [...def.skills],
    runtime: def.runtime,
    provider: undefined,
    squad: def.squad,
    systemPrompt: def.systemPrompt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export interface SeedAgentsOptions {
  repo: AgentRepo;
  userId: string;
  dir: string;
}

/**
 * Seed seed-agent definitions into the agent repo for a user.
 *
 * Idempotent by (userId, name): an agent whose name already exists for the
 * user is NEVER overwritten (user edits are preserved). Only names currently
 * ABSENT are inserted.
 *
 * NOTE on deletions: this pure function inserts any absent name, so a fully
 * deleted set would be re-seeded. To prevent resurrecting user-deleted agents
 * in production, the worker gate `ensureSeedAgents` only seeds users that own
 * ZERO agents — once a user has any agents, seeding never runs again.
 *
 * Returns the count of newly inserted agents (0 on a no-op re-run).
 */
export async function seedAgents(opts: SeedAgentsOptions): Promise<number> {
  const { repo, userId, dir } = opts;
  const defs = await loadSeedAgents(dir);
  const existing = await repo.findByUserId(userId);
  const existingNames = new Set(existing.map((a) => a.name));

  let inserted = 0;
  for (const def of defs) {
    if (existingNames.has(def.name)) continue;
    await repo.save(toAgent(def, userId));
    inserted += 1;
  }
  return inserted;
}

/**
 * Production gate: seed agents ONLY for users that own ZERO agents.
 *
 * This makes seeding fully restart-safe and respects user intent:
 *  - restart with agents present → no-op (no duplicates, no overwrites),
 *  - user edits an agent → preserved (seeding never re-runs),
 *  - user deletes some agents → those deletions stick (seeding never re-runs).
 *
 * Fresh onboarding creates a user with zero agents, so the next worker start
 * seeds them. Subsequent restarts skip them forever.
 */
export async function ensureSeedAgents(
  repo: AgentRepo,
  userId: string,
  dir: string
): Promise<number> {
  const existing = await repo.findByUserId(userId);
  if (existing.length > 0) return 0;
  return seedAgents({ repo, userId, dir });
}
