import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const tools: McpTool[] = [
  {
    name: 'calendar_list_events',
    description: 'List upcoming events from the user\'s primary Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 10, description: 'Max events to return (default 10).' },
        timeMin: { type: 'string', description: 'Lower bound (RFC3339) for event start time. Defaults to now.' },
        calendarId: { type: 'string', default: 'primary', description: 'Calendar ID (default "primary").' },
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new event on the user\'s primary Google Calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title.' },
        startDateTime: { type: 'string', description: 'Start datetime in RFC3339 format.' },
        endDateTime: { type: 'string', description: 'End datetime in RFC3339 format.' },
        description: { type: 'string', description: 'Optional event description.' },
        calendarId: { type: 'string', default: 'primary', description: 'Calendar ID (default "primary").' },
      },
      required: ['summary', 'startDateTime', 'endDateTime'],
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
  return process.env['GOOGLE_CALENDAR_TOKEN'];
}

async function listEvents(args: Record<string, unknown>): Promise<McpToolResult> {
  const token = getToken();
  if (!token) return failure('Missing GOOGLE_CALENDAR_TOKEN environment variable');

  const calendarId = typeof args['calendarId'] === 'string' ? args['calendarId'] : 'primary';
  const maxResults = typeof args['maxResults'] === 'number' ? args['maxResults'] : 10;
  const timeMin = typeof args['timeMin'] === 'string' ? args['timeMin'] : new Date().toISOString();

  const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return failure(`Google Calendar API error: ${res.status} ${res.statusText}`);
  return text(await res.json());
}

async function createEvent(args: Record<string, unknown>): Promise<McpToolResult> {
  const token = getToken();
  if (!token) return failure('Missing GOOGLE_CALENDAR_TOKEN environment variable');

  const calendarId = typeof args['calendarId'] === 'string' ? args['calendarId'] : 'primary';
  const body = {
    summary: args['summary'],
    start: { dateTime: args['startDateTime'] },
    end: { dateTime: args['endDateTime'] },
    ...(args['description'] !== undefined ? { description: args['description'] } : {}),
  };

  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return failure(`Google Calendar API error: ${res.status} ${res.statusText}`);
  return text(await res.json());
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'calendar_list_events') return listEvents(args);
      if (name === 'calendar_create_event') return createEvent(args);
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};
