/**
 * ElevenLabs TTS provider — HTTP REST API.
 */

import type { TtsOptions, TtsProvider } from './types';

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

export class ElevenLabsTtsProvider implements TtsProvider {
  constructor(private readonly apiKey: string, private readonly defaultVoiceId: string = DEFAULT_VOICE_ID) {}

  async synthesize(text: string, options?: TtsOptions): Promise<Buffer> {
    const voiceId = options?.voice ?? this.defaultVoiceId;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: options?.model ?? 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: options?.speed ?? 1.0 },
      }),
    });

    if (!res.ok) throw new Error(`ElevenLabs error ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async *streamSynthesize(text: string, options?: TtsOptions): AsyncIterable<Buffer> {
    const voiceId = options?.voice ?? this.defaultVoiceId;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: options?.model ?? 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok || !res.body) throw new Error(`ElevenLabs stream error ${res.status}`);

    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
}
