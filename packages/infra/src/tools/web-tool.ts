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

  async execute(input: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const callId = `web-${Date.now()}`;
    const op = String(input['operation'] ?? '');

    try {
      if (op === 'fetch') return await this.runFetch(input, ctx, callId);
      if (op === 'search') return await this.runSearch(input, ctx, callId);
      return ToolResult.error(callId, `Unknown operation: ${op}`);
    } catch (err) {
      return ToolResult.error(callId, err instanceof Error ? err.message : String(err));
    }
  }

  /** Fetch a URL and return up to 50K chars of its body. */
  private async runFetch(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
    callId: string
  ): Promise<ToolResult> {
    const url = String(input['url'] ?? '');
    if (!url) return ToolResult.error(callId, 'url is required for fetch operation');
    const text = await this.fetchText(url, ctx);
    return ToolResult.ok(callId, text.slice(0, 50_000));
  }

  /** Search DuckDuckGo and return up to 50K chars of its HTML body. */
  private async runSearch(
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
    callId: string
  ): Promise<ToolResult> {
    const query = String(input['query'] ?? '');
    if (!query) return ToolResult.error(callId, 'query is required for search operation');
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const text = await this.fetchText(url, ctx);
    return ToolResult.ok(callId, text.slice(0, 50_000));
  }

  /** Shared fetch with the Wolfkrow user-agent and abort-signal forwarding (P1-6). */
  private async fetchText(url: string, ctx: ToolExecutionContext): Promise<string> {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Wolfkrow/1.0' },
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });
    return resp.text();
  }
}
