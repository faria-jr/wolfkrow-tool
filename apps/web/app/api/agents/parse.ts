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
  provider: string | undefined;
  squad: Squad | undefined;
  systemPrompt: string | undefined;
} {
  return {
    description: b.description !== undefined ? String(b.description) : undefined,
    thinkingBudget: b.thinkingBudget !== undefined ? Number(b.thinkingBudget) : undefined,
    provider: b.provider !== undefined ? String(b.provider) : undefined,
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
  const extra: AgentUpdateInput = {};

  if (b.maxTurns !== undefined) extra.maxTurns = Number(b.maxTurns);
  if (b.allowedTools !== undefined) extra.allowedTools = b.allowedTools as string[];
  if (b.mcpServers !== undefined) extra.mcpServers = b.mcpServers as string[];
  if (b.isActive !== undefined) extra.isActive = Boolean(b.isActive);
  if (b.skills !== undefined) extra.skills = b.skills as string[];
  if (b.runtime !== undefined) extra.runtime = b.runtime as Runtime;
  if (b.squad !== undefined) extra.squad = b.squad as Squad;
  if (b.systemPrompt !== undefined) extra.systemPrompt = String(b.systemPrompt);

  return extra;
}

function parseProvider(b: Body): Pick<AgentUpdateInput, 'provider'> {
  return b.provider !== undefined ? { provider: b.provider ? String(b.provider) : undefined } : {};
}

export function parsePatchInput(b: Body): AgentUpdateInput {
  return { ...parsePatchCore(b), ...parsePatchExtra(b), ...parseProvider(b) };
}
