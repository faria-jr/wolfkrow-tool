/**
 * Abstração de provider de IA (Strategy — §1.5 O).
 * Streaming-first: chat exige `query()` (AsyncIterable). `complete()` é
 * conveniência não-streaming (acumula chunks). `countTokens()` p/ orçamento.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionOptions {
  model: string;
  /** Multi-turn. Use [{role:'user', content}] p/ prompt único. */
  messages: ChatMessage[];
  /** System prompt separado (concatenado à frente pelo provider). */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Abortar streaming (botão Stop) — repassado ao SDK. */
  signal?: AbortSignal;
}

/** Chunk incremental de stream. delta vazio + done=true encerra com usage. */
export interface StreamChunk {
  delta: string;
  inputTokens?: number;
  outputTokens?: number;
  done?: boolean;
}

export interface CompletionResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
}

export interface AIProvider {
  /** Stream de resposta. Último chunk carrega usage (done=true). */
  query(options: CompletionOptions): AsyncIterable<StreamChunk>;
  /** Não-streaming: acumula `query()` e retorna conteúdo completo. */
  complete(options: CompletionOptions): Promise<CompletionResult>;
  /** Estimativa de tokens (heurística ou API nativa do provider). */
  countTokens(messages: ChatMessage[], model: string): Promise<number>;
}

export interface AIProviderFactory {
  create(provider: string, apiKey: string): AIProvider;
}
