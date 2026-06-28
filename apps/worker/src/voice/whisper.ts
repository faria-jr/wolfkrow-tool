/**
 * Whisper STT — local whisper.cpp subprocess (preferred) with OpenAI API fallback.
 *
 * Backend selection:
 *   WHISPER_BIN_PATH=/usr/local/bin/whisper-cpp → local subprocess
 *   (unset)                                      → OpenAI Whisper API
 *
 * Local backend falls back to API on non-zero exit code or JSON parse failure.
 */

import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SttProvider, SttResult } from './types';

export class WhisperSttProvider implements SttProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<SttResult> {
    const t0 = Date.now();
    const binPath = process.env['WHISPER_BIN_PATH'];

    if (binPath) {
      const local = await this.transcribeLocal(audioBuffer, binPath);
      if (local !== null) return { ...local, durationMs: Date.now() - t0 };
    }

    return this.transcribeApi(audioBuffer, mimeType, t0);
  }

  private async transcribeLocal(
    audioBuffer: Buffer,
    binPath: string
  ): Promise<Omit<SttResult, 'durationMs'> | null> {
    const tmpAudio = join(tmpdir(), `whisper-${Date.now()}.wav`);
    try {
      await writeFile(tmpAudio, audioBuffer);
      const output = await this.runWhisperBin(binPath, tmpAudio);
      if (output === null) return null;
      const parsed = JSON.parse(output) as { text: string; language?: string };
      return {
        text: parsed.text.trim(),
        ...(parsed.language !== undefined ? { language: parsed.language } : {}),
      };
    } catch {
      return null;
    } finally {
      await unlink(tmpAudio).catch(() => undefined);
    }
  }

  private runWhisperBin(binPath: string, audioPath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(binPath, ['--output-json', '--output-file', '/dev/stdout', audioPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on('close', (code) => {
        resolve(code === 0 ? stdout : null);
      });
    });
  }

  private async transcribeApi(
    audioBuffer: Buffer,
    mimeType: string,
    t0: number
  ): Promise<SttResult> {
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
