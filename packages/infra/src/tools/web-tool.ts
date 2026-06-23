import { ToolResult } from '@wolfkrow/domain';
import type { ToolExecutionContext, ToolExecutor } from '@wolfkrow/domain';

export class WebTool implements ToolExecutor {
  readonly name = 'web';
  readonly description = 'Fetch the content of a URL or perform a web search.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['fetch', 'search'] },
      url: { type: 'string', description: 'URL to fetch (fetch operation)' },
      query: { type: 'string', description: 'Search query (search operation)' },
    },
    required: ['operation'],
  };

  async execute(input: Record<string, unknown>, _ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `web-${Date.now()}`;
    const op = String(input['operation'] ?? '');

    try {
      if (op === 'fetch') {
        const url = String(input['url'] ?? '');
        if (!url) return ToolResult.error(callId, 'url is required for fetch operation');
        const resp = await fetch(url, { headers: { 'User-Agent': 'Wolfkrow/1.0' } });
        const text = await resp.text();
        const truncated = text.slice(0, 50_000);
        return ToolResult.ok(callId, truncated);
      }

      if (op === 'search') {
        const query = String(input['query'] ?? '');
        if (!query) return ToolResult.error(callId, 'query is required for search operation');
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'Wolfkrow/1.0' } });
        const text = await resp.text();
        return ToolResult.ok(callId, text.slice(0, 50_000));
      }

      return ToolResult.error(callId, `Unknown operation: ${op}`);
    } catch (err) {
      return ToolResult.error(callId, err instanceof Error ? err.message : String(err));
    }
  }
}
