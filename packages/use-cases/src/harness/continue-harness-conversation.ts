import type { AIStreamPort } from '@wolfkrow/domain';

/**
 * F2.1 — Conversational HITL for the harness run console.
 *
 * Unlike the feedback-parking channel (recordFeedback → drained on next round),
 * this streams a real LLM reply to the operator's message, grounded in the
 * sprint's feature spec + the latest coder/evaluator output. The operator can
 * ask "why did the coder take this approach?" / "what's left?" and get an answer
 * from the same provider/model the run is using.
 *
 * Streams via the injected `AIStreamPort` (the caller wires it to SSE).
 */

export interface ContinueHarnessConversationInput {
  projectId: string;
  /** The operator's message. */
  message: string;
  /** Feature context (name + description + acceptance criteria), if known. */
  featureContext?: {
    name: string;
    description: string;
    acceptanceCriteria: string[];
  };
  /** Latest coder output (so the reply is grounded in what was just produced). */
  latestCoderOutput?: string;
}

export interface ContinueHarnessConversationOptions {
  model: string;
  systemPrompt?: string;
}

export class ContinueHarnessConversationUseCase {
  constructor(private readonly aiProvider: AIStreamPort) {}

  async *execute(
    input: ContinueHarnessConversationInput,
    options: ContinueHarnessConversationOptions
  ): AsyncIterable<string> {
    const system = options.systemPrompt ?? buildHarnessChatSystem(input.featureContext);
    const prompt = buildHarnessChatPrompt(input);

    const stream = await this.aiProvider.query({
      model: options.model,
      system,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      if (chunk.delta) yield chunk.delta;
    }
  }
}

function buildHarnessChatSystem(
  feature?: ContinueHarnessConversationInput['featureContext']
): string {
  const featureLine = feature
    ? `\n\nYou are currently working on this feature:\n- Name: ${feature.name}\n- Description: ${feature.description}\n- Acceptance criteria:\n${feature.acceptanceCriteria.map((c) => `  • ${c}`).join('\n')}`
    : '';
  return [
    'You are the AI agent running a Harness sprint (coder→evaluator loop).',
    'The operator is chatting with you while the sprint runs.',
    'Answer their question concisely, grounded in the sprint context.',
    'Do NOT claim to have completed work you have not done.',
    featureLine,
  ].join('\n');
}

function buildHarnessChatPrompt(input: ContinueHarnessConversationInput): string {
  const parts: string[] = [`Operator message: ${input.message}`];
  if (input.latestCoderOutput) {
    const trimmed = input.latestCoderOutput.slice(-4000);
    parts.push(`\nLatest coder output (tail):\n${trimmed}`);
  }
  return parts.join('\n');
}
