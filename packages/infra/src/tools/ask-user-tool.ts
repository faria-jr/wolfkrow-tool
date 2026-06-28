import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

/**
 * `__wolfkrow_ask_user` sentinel: the AskUserTool does not block here. Instead
 * it returns a detectable result; the SSE transport (writeStreamAsSse) sees it,
 * emits a `human_question` event, parks a promise in human-question-store, and
 * substitutes the user's answer as the tool result. Keeps the tool stateless
 * and the round-trip logic in one place.
 */
export const ASK_USER_SENTINEL = '__wolfkrow_ask_user';

export function parseAskUserResult(
  output: string
): { question: string; options: string[] } | null {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (parsed['__type'] !== ASK_USER_SENTINEL) return null;
    return {
      question: String(parsed['question'] ?? ''),
      options: Array.isArray(parsed['options']) ? (parsed['options'] as string[]) : [],
    };
  } catch {
    return null;
  }
}

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
    return ToolResult.ok(
      callId,
      JSON.stringify({
        __type: ASK_USER_SENTINEL,
        question,
        options: input['options'] ?? [],
      })
    );
  }
}
