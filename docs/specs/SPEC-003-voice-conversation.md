# SPEC-003: Voice Conversation (STT + TTS + VAD)

**Status**: 📝 Draft
**Camada**: Web + Worker
**Prioridade**: P1 (importante)
**Owner**: TBD

---

## 1. Visão Geral

Conversa por voz em tempo real com Voice Activity Detection (VAD) no client, Speech-to-Text (STT) e Text-to-Speech (TTS) no Worker. Suporta barge-in (user interrompe assistant).

### Objetivos

- VAD client-side (Web Audio API)
- Barge-in support
- STT: Whisper local OU OpenAI API
- TTS: ElevenLabs (default) OU Cartesia
- Latência end-to-end <500ms
- Voice orb animado com estados visuais

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│              Browser                                     │
│                                                          │
│  useVoiceConversation()                                  │
│  ├─ VoiceOrb (visual feedback)                           │
│  ├─ VoiceRecorder (mic capture + VAD)                    │
│  ├─ AudioPlayer (TTS playback)                           │
│  └─ VoiceActivityFeed (logs)                             │
└──────────────────────────┬───────────────────────────────┘
                           │ Audio blob / stream
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Worker                                      │
│                                                          │
│  /voice/stt (POST audio → text)                          │
│  /voice/tts (POST text → audio stream)                   │
│  /voice/tts/stream (WebSocket: bidirectional)            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. VAD (Voice Activity Detection)

### Algoritmo

```typescript
// apps/web/lib/voice/vad.ts
import { useEffect, useRef, useState } from 'react';

export function useVAD() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const streamRef = useRef<MediaStream>();

  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(analyser);

      // Poll for voice activity
      const buffer = new Float32Array(analyser.fftSize);
      let silenceFrames = 0;
      const SILENCE_THRESHOLD = 0.01;
      const SILENCE_FRAMES_REQUIRED = 30; // ~500ms @ 60fps

      const check = () => {
        analyser.getFloatTimeDomainData(buffer);
        const rms = Math.sqrt(buffer.reduce((sum, x) => sum + x * x, 0) / buffer.length);

        if (rms > SILENCE_THRESHOLD) {
          if (!isSpeaking) setIsSpeaking(true);
          silenceFrames = 0;
        } else {
          silenceFrames++;
          if (silenceFrames > SILENCE_FRAMES_REQUIRED && isSpeaking) {
            setIsSpeaking(false);
            onSilenceEnd?.(); // Trigger STT
          }
        }

        requestAnimationFrame(check);
      };

      check();
    };

    start();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  return { isSpeaking };
}
```

---

## 3. STT (Speech-to-Text)

### Whisper Local

```typescript
// apps/worker/src/voice/whisper.ts
import { spawn } from 'node:child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export class WhisperLocal {
  constructor(
    private binaryPath: string,
    private modelPath: string
  ) {}

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const tmpFile = join(tmpdir(), `whisper-${Date.now()}.webm`);
    await fs.writeFile(tmpFile, audioBuffer);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, [
        '-m',
        this.modelPath,
        '-f',
        tmpFile,
        '--output-txt',
        '--language',
        'auto',
        '--threads',
        '4',
      ]);

      let output = '';
      proc.stdout.on('data', (data) => (output += data.toString()));
      proc.stderr.on('data', (data) => logger.debug({ data: data.toString() }, 'whisper'));

      proc.on('close', (code) => {
        fs.unlink(tmpFile).catch(() => {});
        if (code === 0) resolve(output.trim());
        else reject(new Error(`Whisper exited ${code}`));
      });
    });
  }
}
```

### OpenAI Whisper API

```typescript
// apps/worker/src/voice/openai-whisper.ts
import OpenAI from 'openai';

export class OpenAIWhisper {
  constructor(private apiKey: string) {}

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const openai = new OpenAI({ apiKey: this.apiKey });

    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt', // Or 'auto'
    });

    return transcription.text;
  }
}
```

---

## 4. TTS (Text-to-Speech)

### ElevenLabs

```typescript
// apps/worker/src/voice/elevenlabs.ts
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export class ElevenLabsTTS {
  constructor(
    private apiKey: string,
    private voiceId: string
  ) {}

  async *synthesize(text: string): AsyncIterable<Buffer> {
    const client = new ElevenLabsClient({ apiKey: this.apiKey });

    const audioStream = await client.textToSpeech.convertAsStream(this.voiceId, {
      text,
      modelId: 'eleven_turbo_v2_5',
      outputFormat: 'mp3_44100_128',
    });

    for await (const chunk of audioStream) {
      yield Buffer.from(chunk);
    }
  }
}
```

### Cartesia (low latency)

```typescript
// apps/worker/src/voice/cartesia.ts
import WebSocket from 'ws';

export class CartesiaTTS {
  private ws?: WebSocket;

  constructor(
    private apiKey: string,
    private voiceId: string
  ) {}

  async *synthesize(text: string): AsyncIterable<Buffer> {
    // Cartesia uses WebSocket for streaming
    this.ws = new WebSocket(
      `wss://api.cartesia.ai/tts/websocket?api_key=${this.apiKey}&cartesia_version=2024-06-10`
    );

    const queue: Buffer[] = [];
    let resolveNext: ((chunk: Buffer | null) => void) | null = null;

    this.ws.on('message', (data: Buffer) => {
      if (resolveNext) {
        resolveNext(data);
        resolveNext = null;
      } else {
        queue.push(data);
      }
    });

    await new Promise<void>((resolve) => this.ws!.once('open', resolve));

    this.ws.send(
      JSON.stringify({
        model_id: 'sonic-english',
        transcript: text,
        voice: { mode: 'id', id: this.voiceId },
        output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
        stream: true,
      })
    );

    while (true) {
      let chunk: Buffer | null = null;

      if (queue.length > 0) {
        chunk = queue.shift()!;
      } else {
        chunk = await new Promise<Buffer | null>((resolve) => {
          resolveNext = resolve;
        });
      }

      if (chunk === null) break; // EOF

      yield chunk;
    }
  }

  close() {
    this.ws?.close();
  }
}
```

---

## 5. Barge-In

```typescript
// apps/web/lib/voice/useBargeIn.ts
'use client';
export function useBargeIn(isPlaying: boolean, onBargeIn: () => void) {
  const { isSpeaking } = useVAD();

  useEffect(() => {
    if (isPlaying && isSpeaking) {
      onBargeIn(); // Stop TTS playback
    }
  }, [isPlaying, isSpeaking]);

  return { isSpeaking };
}
```

---

## 6. UI

### VoiceOrb Component

```tsx
'use client';
export function VoiceOrb({ state, audioLevel }: { state: VoiceState; audioLevel: number }) {
  return (
    <div className="relative h-32 w-32">
      <motion.div
        className={cn(
          'absolute inset-0 rounded-full',
          state === 'idle' && 'bg-zinc-700',
          state === 'listening' && 'bg-blue-500',
          state === 'speaking' && 'bg-green-500',
          state === 'thinking' && 'bg-amber-500',
          state === 'error' && 'bg-red-500'
        )}
        animate={{
          scale:
            state === 'listening' && audioLevel > 0.01
              ? 1 + audioLevel * 2
              : state === 'speaking'
                ? [1, 1.1, 1]
                : 1,
        }}
        transition={{
          duration: 0.3,
          repeat: state === 'speaking' ? Infinity : 0,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-4xl">
        {state === 'idle' && '🎙️'}
        {state === 'listening' && '👂'}
        {state === 'speaking' && '🗣️'}
        {state === 'thinking' && '🤔'}
      </div>
    </div>
  );
}
```

---

## 7. Database Schema

```typescript
// Voice sessions tracked separately for analytics
export const voiceSessions = sqliteTable('voice_sessions', {
  id: text('id').primaryKey(),
  chatSessionId: text('chat_session_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  totalDurationMs: integer('total_duration_ms').default(0),
  sttProvider: text('stt_provider', { enum: ['whisper-local', 'openai-whisper'] }),
  ttsProvider: text('tts_provider', { enum: ['elevenlabs', 'cartesia'] }),
  ttsVoice: text('tts_voice'),
  turnCount: integer('turn_count').default(0),
  bargeInCount: integer('barge_in_count').default(0),
});
```

---

## 8. Testes

### Unit

- VAD threshold detection
- Whisper transcription
- ElevenLabs streaming
- Cartesia WebSocket
- Barge-in detection

### Integration

- Full voice flow: speak → STT → chat → TTS → playback
- Barge-in interrupts TTS
- Network drop recovery

### E2E

- User clicks mic → speaks → sees transcription
- Assistant responds with voice
- User interrupts with voice
- Mic permission denied handling
