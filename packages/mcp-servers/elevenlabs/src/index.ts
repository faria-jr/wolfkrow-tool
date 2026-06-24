#!/usr/bin/env node
/**
 * MCP server: elevenlabs
 *
 * Text-to-speech via ElevenLabs API. Requires ELEVENLABS_API_KEY and a
 * voice_id (e.g. "21m00Tcm4TlvDq8ikWAM" for Rachel). Returns base64-encoded
 * audio in the JSON-RPC text payload along with metadata.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

function getApiKey(): string | undefined {
  return process.env['ELEVENLABS_API_KEY'];
}

const tools: McpTool[] = [
  {
    name: 'list_voices',
    description: 'List available ElevenLabs voices for the account.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'text_to_speech',
    description: 'Synthesize speech from text. Returns base64 audio + metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to synthesize' },
        voice_id: { type: 'string', description: 'Voice id (default from ELEVENLABS_VOICE_ID env)' },
        model_id: {
          type: 'string',
          description: 'Model id (default "eleven_multilingual_v2")',
        },
      },
      required: ['text'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function elevenGet(path: string): Promise<unknown> {
  const key = getApiKey();
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  const res = await fetch(`${ELEVENLABS_API}${path}`, {
    headers: { 'xi-api-key': key },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs GET ${path} -> ${res.status}: ${errText}`);
  }
  return res.json();
}

async function elevenPostAudio(
  path: string,
  body: Record<string, unknown>,
): Promise<{ contentType: string; audioBase64: string; sizeBytes: number }> {
  const key = getApiKey();
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  const res = await fetch(`${ELEVENLABS_API}${path}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs POST ${path} -> ${res.status}: ${errText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    contentType: res.headers.get('content-type') ?? 'audio/mpeg',
    audioBase64: buf.toString('base64'),
    sizeBytes: buf.length,
  };
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_voices') {
        return text(await elevenGet('/voices'));
      }
      if (name === 'text_to_speech') {
        const inputText = String(args['text'] ?? '');
        if (!inputText) return failure('text_to_speech requires a "text" argument');
        const voiceId = String(
          args['voice_id'] ?? process.env['ELEVENLABS_VOICE_ID'] ?? '',
        );
        if (!voiceId) {
          return failure(
            'voice_id argument missing and ELEVENLABS_VOICE_ID env not set',
          );
        }
        const modelId = String(args['model_id'] ?? 'eleven_multilingual_v2');
        const audio = await elevenPostAudio(`/text-to-speech/${encodeURIComponent(voiceId)}`, {
          text: inputText,
          model_id: modelId,
        });
        return text({
          ...audio,
          voice_id: voiceId,
          model_id: modelId,
          text_length: inputText.length,
        });
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
