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

export interface ImagePart {
  mimeType: string; // 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string; // base64-encoded
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
  /** T21: vision blocks injected into the last user message. */
  imageParts?: ImagePart[];
}

/** Chunk incremental de stream. delta vazio + done=true encerra com usage. */
export interface ToolPermissionEvent {
  callId: string;
  name: string;
  input: Record<string, unknown>;
  prompt: string;
}

export interface StreamChunk {
  delta: string;
  inputTokens?: number;
  outputTokens?: number;
  done?: boolean;
  /** Emitted when AI requests a tool call. */
  toolCall?: { id: string; name: string; input: Record<string, unknown> };
  /** Emitted after a tool has been executed. */
  toolResult?: { callId: string; output: string; isError: boolean };
  /** T17: emitted when a destructive tool needs user approval (PermissionResult 'ask'). */
  toolPermission?: ToolPermissionEvent;
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
