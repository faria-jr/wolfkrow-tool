/**
 * Port de streaming AI (domínio). Implementado em infra pelos providers concretos.
 */

export type AIChatRole = 'system' | 'user' | 'assistant';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIStreamChunk {
  delta: string;
  inputTokens?: number;
  outputTokens?: number;
  done?: boolean;
  toolCall?: { id: string; name: string; input: Record<string, unknown> };
  toolResult?: { callId: string; output: string; isError: boolean };
  /** T17: emitted when a destructive tool requires user approval. */
  toolPermission?: { callId: string; name: string; input: Record<string, unknown>; prompt: string };
}

export interface AICompletionOptions {
  model: string;
  messages: AIChatMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AICompletionResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  stopReason?: string;
}

export interface AIStreamPort {
  query(options: AICompletionOptions): AsyncIterable<AIStreamChunk>;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}
