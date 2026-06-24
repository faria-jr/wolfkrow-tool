import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

export class AskUserTool implements ToolExecutor {
 readonly name = 'ask_user';
 readonly description = 'Pause and ask the user a question, returning their answer.';
 readonly inputSchema = {
 type: 'object',
 properties: {
 question: { type: 'string', description: 'Question to ask the user' },
 options: {
 type: 'array',
 items: { type: 'string' },
 description: 'Optional list of choices',
 },
 },
 required: ['question'],
 };

 async execute(input: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
 const callId = `ask-${Date.now()}`;
 const question = String(input['question'] ?? '');
 if (!question) return ToolResult.error(callId, 'question is required');
 // The actual user-question flow is handled at the SSE layer ().
 // Here we emit a sentinel that the SSE transport intercepts.
 return ToolResult.ok(callId, JSON.stringify({ __type: 'ask_user', question, options: input['options'] ?? [] }));
 }
}
