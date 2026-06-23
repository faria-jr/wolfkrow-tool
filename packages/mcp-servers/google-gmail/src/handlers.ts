import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const tools: McpTool[] = [
  {
    name: 'gmail_search_messages',
    description: 'Search Gmail messages using Gmail query syntax (e.g. "from:boss@example.com is:unread").',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query.' },
        maxResults: { type: 'number', default: 10, description: 'Max messages to return (default 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'gmail_get_message',
    description: 'Get a specific Gmail message by its ID, including headers and snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Gmail message ID.' },
      },
      required: ['messageId'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function getToken(): string | undefined {
  return process.env['GOOGLE_GMAIL_TOKEN'];
}

async function searchMessages(args: Record<string, unknown>): Promise<McpToolResult> {
  const token = getToken();
  if (!token) return failure('Missing GOOGLE_GMAIL_TOKEN environment variable');

  const query = typeof args['query'] === 'string' ? args['query'] : '';
  const maxResults = typeof args['maxResults'] === 'number' ? args['maxResults'] : 10;

  const url = new URL(`${GMAIL_API}/messages`);
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return failure(`Gmail API error: ${res.status} ${res.statusText}`);
  return text(await res.json());
}

async function getMessage(args: Record<string, unknown>): Promise<McpToolResult> {
  const token = getToken();
  if (!token) return failure('Missing GOOGLE_GMAIL_TOKEN environment variable');

  const messageId = typeof args['messageId'] === 'string' ? args['messageId'] : '';
  const res = await fetch(`${GMAIL_API}/messages/${encodeURIComponent(messageId)}?format=metadata`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return failure(`Gmail API error: ${res.status} ${res.statusText}`);
  return text(await res.json());
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'gmail_search_messages') return searchMessages(args);
      if (name === 'gmail_get_message') return getMessage(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};
