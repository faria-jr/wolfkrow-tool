#!/usr/bin/env node
/**
 * MCP server: local-llm
 *
 * Bridges to a local Ollama daemon (default http://localhost:11434).
 * `tools/list` is static; `tools/call` proxies to Ollama's HTTP API.
 * Override the daemon URL via OLLAMA_HOST.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

function getOllamaHost(): string {
  return process.env['OLLAMA_HOST'] ?? DEFAULT_OLLAMA_HOST;
}

const tools: McpTool[] = [
  {
    name: 'list_models',
    description: 'List local Ollama models available on this machine.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'show_model',
    description: 'Show details (modelfile, parameters, template) for a specific Ollama model.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Model name (e.g. llama3.2:3b)' } },
      required: ['name'],
    },
  },
  {
    name: 'chat_completion',
    description: 'Run a chat completion against a local Ollama model (non-streaming).',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name (e.g. llama3.2:3b)' },
        messages: {
          type: 'array',
          description: 'OpenAI-style messages: [{role, content}]',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
      },
      required: ['model', 'messages'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function ollamaGet(path: string): Promise<unknown> {
  const res = await fetch(`${getOllamaHost()}${path}`);
  if (!res.ok) throw new Error(`Ollama ${path} -> ${res.status}`);
  return res.json();
}

async function ollamaPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${getOllamaHost()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_models') {
        return text(await ollamaGet('/api/tags'));
      }
      if (name === 'show_model') {
        const modelName = String(args['name'] ?? '');
        if (!modelName) return failure('show_model requires a "name" argument');
        return text(await ollamaPost('/api/show', { name: modelName }));
      }
      if (name === 'chat_completion') {
        const model = String(args['model'] ?? '');
        const messages = args['messages'];
        if (!model) return failure('chat_completion requires a "model" argument');
        if (!Array.isArray(messages)) return failure('chat_completion requires a "messages" array');
        return text(await ollamaPost('/api/chat', { model, messages, stream: false }));
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
