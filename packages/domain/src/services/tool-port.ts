import type { ToolResult } from '../value-objects/tool-result';

export interface ToolExecutionContext {
  userId: string;
  agentId?: string;
  workDir?: string;
}

export interface ToolExecutor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
}
