/**
 * Cartesia TTS provider — REST API (streaming via /bytes endpoint).
 */

import type { TtsOptions, TtsProvider } from './types';

const DEFAULT_VOICE_ID = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Sonic-English

export class CartesiaTtsProvider implements TtsProvider {
  constructor(private readonly apiKey: string) {}

  async synthesize(text: string, options?: TtsOptions): Promise<Buffer> {
    const voiceId = options?.voice ?? DEFAULT_VOICE_ID;

    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: options?.model ?? 'sonic-english',
        voice: { mode: 'id', id: voiceId },
        output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
        transcript: text,
      }),
    });

    if (!res.ok) throw new Error(`Cartesia error ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async *streamSynthesize(text: string, options?: TtsOptions): AsyncIterable<Buffer> {
    const audio = await this.synthesize(text, options);
    yield audio;
  }
}
