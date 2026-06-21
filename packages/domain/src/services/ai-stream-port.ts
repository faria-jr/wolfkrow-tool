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
