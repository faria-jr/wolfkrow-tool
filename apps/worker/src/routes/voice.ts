/**
 * Voice routes — STT (transcribe) + TTS (synthesize) endpoints.
 * B.4: Voice pipeline with Whisper STT + ElevenLabs/Cartesia TTS.
 */

import keytar from 'keytar';

import type { AuthFastifyInstance } from '../types/fastify';
import { WhisperSttProvider } from '../voice/whisper';
import { ElevenLabsTtsProvider } from '../voice/elevenlabs';

async function getKey(name: string): Promise<string | null> {
  return keytar.getPassword('wolfkrow', name);
}

export async function voiceRoutes(server: AuthFastifyInstance) {
  // POST /voice/transcribe — multipart audio → text
  server.post('/transcribe', async (req, reply) => {
    const apiKey = await getKey('openai-api-key');
    if (!apiKey) return reply.status(503).send({ error: 'OpenAI API key not configured' });

    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const mimeType = data.mimetype || 'audio/webm';

    const stt = new WhisperSttProvider(apiKey);
    const result = await stt.transcribe(buffer, mimeType);
    return { text: result.text, durationMs: result.durationMs };
  });

  // POST /voice/synthesize — text → audio/mpeg stream
  server.post<{ Body: { text: string; voice?: string; provider?: string; model?: string } }>(
    '/synthesize',
    async (req, reply) => {
      const { text, voice, provider = 'elevenlabs', model } = req.body;
      if (!text) return reply.status(400).send({ error: 'text is required' });

      const apiKey = await getKey(`${provider}-api-key`);
      if (!apiKey) return reply.status(503).send({ error: `${provider} API key not configured` });

      const tts = new ElevenLabsTtsProvider(apiKey);
      const audio = await tts.synthesize(text, {
        ...(voice !== undefined ? { voice } : {}),
        ...(model !== undefined ? { model } : {}),
      });

      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Content-Length', audio.length)
        .send(audio);
    },
  );

  // POST /voice/synthesize/stream — streaming TTS
  server.post<{ Body: { text: string; voice?: string } }>(
    '/synthesize/stream',
    async (req, reply) => {
      const { text, voice } = req.body;
      if (!text) return reply.status(400).send({ error: 'text is required' });

      const apiKey = await getKey('elevenlabs-api-key');
      if (!apiKey) return reply.status(503).send({ error: 'ElevenLabs API key not configured' });

      const tts = new ElevenLabsTtsProvider(apiKey);

      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Transfer-Encoding', 'chunked');

      if (!tts.streamSynthesize) {
        const audio = await tts.synthesize(text, voice !== undefined ? { voice } : {});
        return reply.send(audio);
      }

      const stream = tts.streamSynthesize(text, voice !== undefined ? { voice } : {});
      for await (const chunk of stream) {
        (reply.raw as { write: (b: Buffer) => void }).write(chunk);
      }
      (reply.raw as { end: () => void }).end();
    },
  );
}
