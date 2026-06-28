#!/usr/bin/env node
/**
 * MCP server: google-drive
 *
 * Bridges to Google Drive API v3. Requires GOOGLE_DRIVE_TOKEN (OAuth access
 * token). `tools/list` is static; `tools/call` calls Drive REST API directly.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

function getToken(): string | undefined {
  return process.env['GOOGLE_DRIVE_TOKEN'];
}

const tools: McpTool[] = [
  {
    name: 'list_files',
    description: 'List files in Google Drive (optionally filtered by query).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Drive query string (e.g. "name contains \'report\'")',
        },
        pageSize: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'get_file',
    description: 'Get file metadata by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Drive file id' } },
      required: ['id'],
    },
  },
  {
    name: 'share_file',
    description: 'Create a permission so anyone with the link can read the file.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Drive file id' },
        role: {
          type: 'string',
          enum: ['reader', 'writer', 'commenter'],
          description: 'Default reader',
        },
      },
      required: ['id'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function driveGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Drive GET ${path} -> ${res.status}: ${errText}`);
  }
  return res.json();
}

async function drivePost(path: string, body: unknown): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not set');
  const res = await fetch(`${DRIVE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Drive POST ${path} -> ${res.status}: ${errText}`);
  }
  return res.json();
}

async function listFiles(args: Record<string, unknown>): Promise<McpToolResult> {
  const params: Record<string, string> = {
    pageSize: String(typeof args['pageSize'] === 'number' ? args['pageSize'] : 20),
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
  };
  if (typeof args['query'] === 'string' && args['query'].length > 0) {
    params['q'] = args['query'];
  }
  return text(await driveGet('/files', params));
}

async function getFile(args: Record<string, unknown>): Promise<McpToolResult> {
  const id = String(args['id'] ?? '');
  if (!id) return failure('get_file requires an "id" argument');
  return text(
    await driveGet(`/files/${encodeURIComponent(id)}`, {
      fields: 'id,name,mimeType,modifiedTime,size,webViewLink,description',
    })
  );
}

async function shareFile(args: Record<string, unknown>): Promise<McpToolResult> {
  const id = String(args['id'] ?? '');
  if (!id) return failure('share_file requires an "id" argument');
  const role = typeof args['role'] === 'string' ? args['role'] : 'reader';
  return text(
    await drivePost(`/files/${encodeURIComponent(id)}/permissions`, {
      type: 'anyone',
      role,
    })
  );
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_files') return await listFiles(args);
      if (name === 'get_file') return await getFile(args);
      if (name === 'share_file') return await shareFile(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
