import type { ToolResult } from '../value-objects/tool-result';

export interface ToolExecutionContext {
  userId: string;
  agentId?: string;
  workDir?: string;
  /**
   * Abort signal from the originating request (e.g. the user pressed Stop on
   * the SSE stream). Tools that perform long I/O SHOULD observe this signal so
   * an abort cancels in-flight work; the provider loop also skips starting a
   * new tool once aborted. Optional for backward compatibility.
   */
  signal?: AbortSignal;
}

export interface ToolExecutor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
}
