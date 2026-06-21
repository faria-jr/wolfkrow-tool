import type { AgentCreateInput, AgentUpdateInput } from '@wolfkrow/domain';

type Body = Record<string, unknown>;
type Effort = AgentCreateInput['effort'];
type Runtime = AgentCreateInput['runtime'];
type Squad = AgentCreateInput['squad'];

function parseRequiredFields(userId: string, b: Body) {
  return {
    userId,
    name: String(b.name ?? ''),
    model: String(b.model ?? 'claude-sonnet-4-6'),
    effort: (b.effort as Effort) ?? 'medium',
    thinking: Boolean(b.thinking),
    maxTurns: Number(b.maxTurns ?? 80),
    allowedTools: Array.isArray(b.allowedTools) ? (b.allowedTools as string[]) : [],
    mcpServers: Array.isArray(b.mcpServers) ? (b.mcpServers as string[]) : [],
    isActive: b.isActive !== false,
    skills: Array.isArray(b.skills) ? (b.skills as string[]) : [],
    runtime: (b.runtime as Runtime) ?? 'cloud',
  };
}

function parseOptionalCreateFields(b: Body): {
  description: string | undefined;
  thinkingBudget: number | undefined;
  squad: Squad | undefined;
  systemPrompt: string | undefined;
} {
  return {
    description: b.description !== undefined ? String(b.description) : undefined,
    thinkingBudget: b.thinkingBudget !== undefined ? Number(b.thinkingBudget) : undefined,
    squad: b.squad !== undefined ? (b.squad as Squad) : undefined,
    systemPrompt: b.systemPrompt !== undefined ? String(b.systemPrompt) : undefined,
  };
}

export function parseCreateInput(userId: string, b: Body): AgentCreateInput {
  return { ...parseRequiredFields(userId, b), ...parseOptionalCreateFields(b) };
}

function parsePatchCore(b: Body): AgentUpdateInput {
  return {
    ...(b.name !== undefined ? { name: String(b.name) } : {}),
    ...(b.description !== undefined ? { description: String(b.description) } : {}),
    ...(b.model !== undefined ? { model: String(b.model) } : {}),
    ...(b.effort !== undefined ? { effort: b.effort as Effort } : {}),
    ...(b.thinking !== undefined ? { thinking: Boolean(b.thinking) } : {}),
    ...(b.thinkingBudget !== undefined ? { thinkingBudget: Number(b.thinkingBudget) } : {}),
  };
}

function parsePatchExtra(b: Body): AgentUpdateInput {
  return {
    ...(b.maxTurns !== undefined ? { maxTurns: Number(b.maxTurns) } : {}),
    ...(b.allowedTools !== undefined ? { allowedTools: b.allowedTools as string[] } : {}),
    ...(b.mcpServers !== undefined ? { mcpServers: b.mcpServers as string[] } : {}),
    ...(b.isActive !== undefined ? { isActive: Boolean(b.isActive) } : {}),
    ...(b.skills !== undefined ? { skills: b.skills as string[] } : {}),
    ...(b.runtime !== undefined ? { runtime: b.runtime as Runtime } : {}),
    ...(b.squad !== undefined ? { squad: b.squad as Squad } : {}),
    ...(b.systemPrompt !== undefined ? { systemPrompt: String(b.systemPrompt) } : {}),
  };
}

export function parsePatchInput(b: Body): AgentUpdateInput {
  return { ...parsePatchCore(b), ...parsePatchExtra(b) };
}
