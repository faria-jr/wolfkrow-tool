import type { McpHandlers, McpTool, McpToolResult } from '@wolfkrow/mcp-shared';

const tools: McpTool[] = [
  {
    name: 'youtube_search',
    description: 'Search YouTube for videos matching a query. Returns video titles, IDs, and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        maxResults: { type: 'number', default: 5, description: 'Max results to return (default 5).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'youtube_get_transcript',
    description: 'Get the auto-generated transcript for a YouTube video by its ID or URL.',
    inputSchema: {
      type: 'object',
      properties: {
        videoId: { type: 'string', description: 'YouTube video ID (e.g. dQw4w9WgXcQ).' },
      },
      required: ['videoId'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function searchYouTube(query: string, maxResults: number): Promise<McpToolResult> {
  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) return failure('Missing YOUTUBE_API_KEY environment variable');

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(maxResults));

  const res = await fetch(url.toString());
  if (!res.ok) return failure(`YouTube API error: ${res.status} ${res.statusText}`);
  return text(await res.json());
}

async function getTranscript(videoId: string): Promise<McpToolResult> {
  const pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const res = await fetch(pageUrl);
  if (!res.ok) return failure(`Failed to fetch YouTube page: ${res.status}`);
  const html = await res.text();

  const captionsMatch = html.match(/"captionTracks":\s*\[([^\]]+)\]/);
  if (!captionsMatch) return text({ videoId, transcript: null, message: 'No captions found for this video.' });

  const baseUrlMatch = captionsMatch[1]?.match(/"baseUrl":"([^"]+)"/);
  if (!baseUrlMatch) return text({ videoId, transcript: null, message: 'Could not extract caption URL.' });

  return text({ videoId, captionUrl: baseUrlMatch[1]?.replace(/\\u0026/g, '&'), message: 'Use captionUrl to fetch the transcript XML.' });
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'youtube_search') {
        const query = typeof args['query'] === 'string' ? args['query'] : String(args['query'] ?? '');
        const max = typeof args['maxResults'] === 'number' ? args['maxResults'] : 5;
        return searchYouTube(query, max);
      }
      if (name === 'youtube_get_transcript') {
        const videoId = typeof args['videoId'] === 'string' ? args['videoId'] : String(args['videoId'] ?? '');
        return getTranscript(videoId);
      }
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};
