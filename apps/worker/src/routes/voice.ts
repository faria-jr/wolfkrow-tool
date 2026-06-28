/**
 * Voice routes — STT (transcribe) + TTS (synthesize) endpoints.
 * B.4: Voice pipeline with Whisper STT + ElevenLabs/Cartesia TTS.
 */

import { getSecret } from '../lib/keychain';
import type { AuthFastifyInstance } from '../types/fastify';
import { createTtsProvider } from '../voice/factory';
import { WhisperSttProvider } from '../voice/whisper';

async function getKey(name: string): Promise<string | null> {
  return getSecret(name);
}

type RawReply = { raw: { write: (b: Buffer) => void; end: () => void } };

async function streamAudioToResponse(
  stream: AsyncIterable<Buffer>,
  reply: RawReply
): Promise<void> {
  for await (const chunk of stream) reply.raw.write(chunk);
  reply.raw.end();
}

export async function voiceRoutes(server: AuthFastifyInstance) {
  // Transcribe/synthesize are not user-scoped data, but they invoke paid
  // external APIs (Whisper/ElevenLabs) using server-held keys. Require an
  // authenticated session so anonymous callers cannot burn the API budget.
  const auth = { onRequest: [server.authenticate] };

  server.post('/transcribe', auth, async (req, reply) => {
    const apiKey = await getKey('openai-api-key');
    if (!apiKey) return reply.status(503).send({ error: 'OpenAI API key not configured' });

    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const stt = new WhisperSttProvider(apiKey);
    const result = await stt.transcribe(buffer, data.mimetype || 'audio/webm');
    return { text: result.text, durationMs: result.durationMs };
  });

  server.post<{ Body: { text: string; voice?: string; provider?: string; model?: string } }>(
    '/synthesize',
    auth,
    async (req, reply) => {
      const { text, voice, provider = 'elevenlabs', model } = req.body;
      if (!text) return reply.status(400).send({ error: 'text is required' });

      const apiKey = await getKey(`${provider}-api-key`);
      if (!apiKey) return reply.status(503).send({ error: `${provider} API key not configured` });

      const tts = createTtsProvider(provider, apiKey);
      const audio = await tts.synthesize(text, {
        ...(voice !== undefined ? { voice } : {}),
        ...(model !== undefined ? { model } : {}),
      });

      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Content-Length', audio.length)
        .send(audio);
    }
  );

  server.post<{ Body: { text: string; voice?: string; provider?: string } }>(
    '/synthesize/stream',
    auth,
    async (req, reply) => {
      const { text, voice, provider = 'elevenlabs' } = req.body;
      if (!text) return reply.status(400).send({ error: 'text is required' });

      const apiKey = await getKey(`${provider}-api-key`);
      if (!apiKey) return reply.status(503).send({ error: `${provider} API key not configured` });

      const tts = createTtsProvider(provider, apiKey);
      reply.header('Content-Type', 'audio/mpeg').header('Transfer-Encoding', 'chunked');

      if (!tts.streamSynthesize) {
        const audio = await tts.synthesize(text, voice !== undefined ? { voice } : {});
        return reply.send(audio);
      }

      const stream = tts.streamSynthesize(text, voice !== undefined ? { voice } : {});
      await streamAudioToResponse(stream, reply);
    }
  );
}
