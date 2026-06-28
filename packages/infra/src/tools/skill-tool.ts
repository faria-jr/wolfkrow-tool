import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

export class SkillTool implements ToolExecutor {
  readonly name = 'skill';
  readonly description = 'Invoke a named Wolfkrow skill by name.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name to invoke' },
      args: { type: 'object', description: 'Arguments to pass to the skill' },
    },
    required: ['name'],
  };

  async execute(input: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `skill-${Date.now()}`;
    // Stub — full implementation will call SkillRepo and invoke via wolfkrow-skills MCP.
    return ToolResult.ok(
      callId,
      JSON.stringify({ __type: 'skill', name: input['name'], stub: true })
    );
  }
}
