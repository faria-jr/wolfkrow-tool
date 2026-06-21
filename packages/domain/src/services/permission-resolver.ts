const SAFE_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Bash:echo', 'Bash:cat', 'Bash:ls',
]);

const DESTRUCTIVE_TOOLS = new Set([
  'Bash:rm', 'Bash:sudo', 'Bash:git push', 'Bash:drop', 'Bash:delete',
  'Write', 'Edit',
]);

export type PermissionResult =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'ask'; prompt: string };

export interface AgentPermissions {
  allowedTools: string[];   // whitelist — if non-empty, only these are allowed
  blockedTools?: string[];  // blacklist — always denied
}

export class PermissionResolver {
  resolve(agent: AgentPermissions, tool: string, _input?: unknown): PermissionResult {
    // blacklist takes precedence
    if (agent.blockedTools?.includes(tool)) {
      return { type: 'deny', reason: `Tool "${tool}" is blacklisted for this agent` };
    }

    // SAFE tools always allowed (no confirmation needed)
    if (SAFE_TOOLS.has(tool)) return { type: 'allow' };

    // Destructive tools → ask
    if (DESTRUCTIVE_TOOLS.has(tool)) {
      return { type: 'ask', prompt: `Agent wants to use "${tool}". Allow?` };
    }

    // Whitelist: if defined and non-empty, only listed tools allowed
    if (agent.allowedTools.length > 0) {
      if (agent.allowedTools.includes(tool)) return { type: 'allow' };
      return { type: 'deny', reason: `Tool "${tool}" not in agent whitelist` };
    }

    // Default: deny unknown tools
    return { type: 'deny', reason: `Tool "${tool}" is not permitted` };
  }
}

export const defaultPermissionResolver = new PermissionResolver();
