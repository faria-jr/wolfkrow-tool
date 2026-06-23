import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

export class MemoryTool implements ToolExecutor {
  readonly name = 'memory';
  readonly description = 'Read and write entries to agent semantic memory.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['read', 'write', 'search'] },
      key: { type: 'string', description: 'Memory key (read/write)' },
      content: { type: 'string', description: 'Content to write' },
      query: { type: 'string', description: 'Query for semantic search' },
    },
    required: ['operation'],
  };

  async execute(input: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `mem-${Date.now()}`;
    // Stub — full implementation in T29 (compaction engine) will wire to SemanticMemoryRepo.
    return ToolResult.ok(callId, JSON.stringify({ __type: 'memory', operation: input['operation'], stub: true }));
  }
}
