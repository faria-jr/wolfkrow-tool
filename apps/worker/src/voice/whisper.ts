/**
 * Whisper STT — delegates to OpenAI Whisper API (local model support planned).
 */

import type { SttProvider, SttResult } from './types';

export class WhisperSttProvider implements SttProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<SttResult> {
    const t0 = Date.now();

    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { text: string };
    return { text: data.text.trim(), durationMs: Date.now() - t0 };
  }
}
