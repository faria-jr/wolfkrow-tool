/**
 * Shared agent system-prompt composition .
 *
 * Composes the agent's base prompt + enabled global rules + the agent's
 * attached skills, via BuildSystemPromptUseCase. Used by both the scheduled
 * task executor and the chat orchestrator so an Agent row drives the real
 * system prompt sent to the LLM.
 */

import { BuildSystemPromptUseCase } from '@wolfkrow/use-cases';

import { getRepos } from './container';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

export interface AgentPromptLike {
 userId: string;
 skills: string[];
 systemPrompt: string | undefined;
}

/** Resolve the agent's attached skills (names) → `name: description` lines. */
export async function resolveSkillDescriptions(
 agent: AgentPromptLike | null,
 userId: string,
): Promise<string[]> {
 if (!agent || agent.skills.length === 0) return [];
 const userSkills = await getRepos().skill.findByUserId(userId);
 return userSkills
 .filter((s) => agent.skills.includes(s.name))
 .map((s) => `${s.name}: ${s.description}`);
}

/** Compose system prompt = agent prompt + enabled rules + skills. */
export async function buildAgentSystemPrompt(
 agent: AgentPromptLike | null,
 userId: string,
): Promise<string> {
 const skillDescriptions = await resolveSkillDescriptions(agent, userId);
 return new BuildSystemPromptUseCase(getRepos().globalRule).execute({
 userId,
 agentSystemPrompt: agent?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
 ...(skillDescriptions.length ? { skillDescriptions } : {}),
 });
}
