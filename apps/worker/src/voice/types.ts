export interface SttResult {
  text: string;
  language?: string;
  durationMs: number;
}

export interface TtsOptions {
  voice?: string;
  speed?: number;
  model?: string;
}

export interface SttProvider {
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<SttResult>;
}

export interface TtsProvider {
  synthesize(text: string, options?: TtsOptions): Promise<Buffer>;
  streamSynthesize?(text: string, options?: TtsOptions): AsyncIterable<Buffer>;
}
