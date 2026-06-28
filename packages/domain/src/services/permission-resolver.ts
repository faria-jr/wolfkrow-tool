const SAFE_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
  'Bash:echo',
  'Bash:cat',
  'Bash:ls',
]);

const DESTRUCTIVE_TOOLS = new Set([
  'Bash:rm',
  'Bash:sudo',
  'Bash:git push',
  'Bash:drop',
  'Bash:delete',
  'Write',
  'Edit',
]);

export type PermissionResult =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'ask'; prompt: string };

export interface AgentPermissions {
  allowedTools: string[]; // whitelist — if non-empty, only these are allowed
  blockedTools?: string[]; // blacklist — always denied
}

export class PermissionResolver {
  canUseTool(agent: AgentPermissions, tool: string, input?: unknown): PermissionResult {
    return this.resolve(agent, tool, input);
  }

  resolve(agent: AgentPermissions, tool: string, _input?: unknown): PermissionResult {
    // blacklist takes precedence
    if (agent.blockedTools?.includes(tool)) {
      return { type: 'deny', reason: `Tool "${tool}" is blacklisted for this agent` };
    }

    // Whitelist gates what tools the agent may use at all
    if (agent.allowedTools.length > 0 && !agent.allowedTools.includes(tool)) {
      return { type: 'deny', reason: `Tool "${tool}" not in agent whitelist` };
    }

    // SAFE tools always allowed (no confirmation needed)
    if (SAFE_TOOLS.has(tool)) return { type: 'allow' };

    // Destructive tools → ask user for confirmation
    if (DESTRUCTIVE_TOOLS.has(tool)) {
      return { type: 'ask', prompt: `Agent wants to use "${tool}". Allow?` };
    }

    // Unknown tool: allow if whitelisted, deny otherwise
    if (agent.allowedTools.length > 0) return { type: 'allow' };
    return { type: 'deny', reason: `Tool "${tool}" is not permitted` };
  }
}

export const defaultPermissionResolver = new PermissionResolver();
