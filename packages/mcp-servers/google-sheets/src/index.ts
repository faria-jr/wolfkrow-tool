#!/usr/bin/env node
/**
 * MCP server: google-sheets
 *
 * Bridges to Google Sheets API v4. Requires GOOGLE_SHEETS_TOKEN (OAuth access
 * token). `tools/list` is static; `tools/call` calls Sheets REST API directly.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function getToken(): string | undefined {
  return process.env['GOOGLE_SHEETS_TOKEN'];
}

const tools: McpTool[] = [
  {
    name: 'list_sheets',
    description: 'List the worksheets (tabs) in a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: { spreadsheetId: { type: 'string', description: 'Spreadsheet id' } },
      required: ['spreadsheetId'],
    },
  },
  {
    name: 'read_sheet',
    description: 'Read a range from a worksheet (A1 notation, e.g. "Sheet1!A1:D10").',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet id' },
        range: { type: 'string', description: 'A1 notation range' },
      },
      required: ['spreadsheetId', 'range'],
    },
  },
  {
    name: 'append_rows',
    description: 'Append rows to a worksheet (creates it implicitly if missing).',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Spreadsheet id' },
        range: { type: 'string', description: 'A1 notation target range' },
        values: {
          type: 'array',
          description: '2D array of cell values (rows of columns)',
          items: { type: 'array' },
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function sheetsFetch(path: string, init: RequestInit): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error('GOOGLE_SHEETS_TOKEN not set');
  const res = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Sheets ${path} -> ${res.status}: ${errText}`);
  }
  return res.json();
}

async function listSheets(args: Record<string, unknown>): Promise<McpToolResult> {
  const spreadsheetId = String(args['spreadsheetId'] ?? '');
  if (!spreadsheetId) return failure('list_sheets requires a "spreadsheetId" argument');
  return text(
    await sheetsFetch(`/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`, {
      method: 'GET',
    })
  );
}

async function readSheet(args: Record<string, unknown>): Promise<McpToolResult> {
  const spreadsheetId = String(args['spreadsheetId'] ?? '');
  const range = String(args['range'] ?? '');
  if (!spreadsheetId || !range) {
    return failure('read_sheet requires "spreadsheetId" and "range" arguments');
  }
  const url = `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  return text(await sheetsFetch(url, { method: 'GET' }));
}

async function appendRows(args: Record<string, unknown>): Promise<McpToolResult> {
  const spreadsheetId = String(args['spreadsheetId'] ?? '');
  const range = String(args['range'] ?? '');
  const values = args['values'];
  if (!spreadsheetId || !range) {
    return failure('append_rows requires "spreadsheetId" and "range" arguments');
  }
  if (!Array.isArray(values)) {
    return failure('append_rows requires a "values" array');
  }
  const url = `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  return text(
    await sheetsFetch(url, {
      method: 'POST',
      body: JSON.stringify({ values }),
    })
  );
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'list_sheets') return await listSheets(args);
      if (name === 'read_sheet') return await readSheet(args);
      if (name === 'append_rows') return await appendRows(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
