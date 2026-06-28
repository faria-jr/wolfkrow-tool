#!/usr/bin/env node
/**
 * MCP server: nano-banana
 *
 * Image generation via the nano-banana provider. Requires NANO_BANANA_API_KEY
 * and an optional NANO_BANANA_BASE_URL (default https://api.nano-banana.com).
 * Returns base64-encoded image bytes in the JSON-RPC text payload.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const DEFAULT_BASE_URL = 'https://api.nano-banana.com';

function getBaseUrl(): string {
  return process.env['NANO_BANANA_BASE_URL'] ?? DEFAULT_BASE_URL;
}
function getApiKey(): string | undefined {
  return process.env['NANO_BANANA_API_KEY'];
}

const tools: McpTool[] = [
  {
    name: 'generate_image',
    description: 'Generate an image from a text prompt. Returns base64 image bytes + metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Image generation prompt' },
        negative_prompt: { type: 'string', description: 'Optional negative prompt' },
        width: { type: 'number', description: 'Image width in pixels (default 1024)' },
        height: { type: 'number', description: 'Image height in pixels (default 1024)' },
        steps: { type: 'number', description: 'Inference steps (default 30)' },
        seed: { type: 'number', description: 'Optional seed for reproducibility' },
      },
      required: ['prompt'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function nanoBananaPost(
  path: string,
  body: Record<string, unknown>
): Promise<{ contentType: string; imageBase64: string; sizeBytes: number }> {
  const key = getApiKey();
  if (!key) throw new Error('NANO_BANANA_API_KEY not set');
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`nano-banana ${path} -> ${res.status}: ${errText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    contentType: res.headers.get('content-type') ?? 'image/png',
    imageBase64: buf.toString('base64'),
    sizeBytes: buf.length,
  };
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'generate_image') {
        const prompt = String(args['prompt'] ?? '');
        if (!prompt) return failure('generate_image requires a "prompt" argument');
        const body: Record<string, unknown> = {
          prompt,
          width: typeof args['width'] === 'number' ? args['width'] : 1024,
          height: typeof args['height'] === 'number' ? args['height'] : 1024,
          steps: typeof args['steps'] === 'number' ? args['steps'] : 30,
        };
        if (typeof args['negative_prompt'] === 'string') {
          body['negative_prompt'] = args['negative_prompt'];
        }
        if (typeof args['seed'] === 'number') body['seed'] = args['seed'];
        const result = await nanoBananaPost('/v1/generate', body);
        return text({
          ...result,
          prompt,
          width: body['width'],
          height: body['height'],
        });
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
