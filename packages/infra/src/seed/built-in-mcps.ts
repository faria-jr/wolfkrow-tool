/**
 * Built-in MCP servers (19 bundled, can be disabled but not deleted)
 *
 * Mirrors mcp-servers/ packages but registered in DB for management UI.
 */

export const BUILT_IN_MCP_SERVERS = [
  {
    name: 'google-calendar',
    description: 'Google Calendar API integration',
    command: 'node',
    args: ['../mcp-servers/google-calendar/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'google-gmail',
    description: 'Gmail API integration',
    command: 'node',
    args: ['../mcp-servers/google-gmail/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'google-drive',
    description: 'Google Drive API integration',
    command: 'node',
    args: ['../mcp-servers/google-drive/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'google-sheets',
    description: 'Google Sheets API integration',
    command: 'node',
    args: ['../mcp-servers/google-sheets/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'elevenlabs',
    description: 'ElevenLabs text-to-speech',
    command: 'node',
    args: ['../mcp-servers/elevenlabs/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'excalidraw',
    description: 'Excalidraw drawing integration',
    command: 'node',
    args: ['../mcp-servers/excalidraw/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'knowledge-base',
    description: 'Semantic search over knowledge base',
    command: 'node',
    args: ['../mcp-servers/knowledge-base/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'memory-search',
    description: 'Semantic search over agent memory',
    command: 'node',
    args: ['../mcp-servers/memory-search/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'local-agents',
    description: 'Local agent runner',
    command: 'node',
    args: ['../mcp-servers/local-agents/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'local-llm',
    description: 'Ollama local LLM',
    command: 'node',
    args: ['../mcp-servers/local-llm/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'skills',
    description: 'Skills MCP server',
    command: 'node',
    args: ['../mcp-servers/skills/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'youtube',
    description: 'YouTube transcript extraction',
    command: 'node',
    args: ['../mcp-servers/youtube/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'shopify',
    description: 'Shopify e-commerce API',
    command: 'node',
    args: ['../mcp-servers/shopify/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'nano-banana',
    description: 'Cohere LLM',
    command: 'node',
    args: ['../mcp-servers/nano-banana/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
  {
    name: 'graph-search',
    description: 'Knowledge graph search',
    command: 'node',
    args: ['../mcp-servers/graph-search/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'wolfkrow-agents',
    description: 'Internal agents',
    command: 'node',
    args: ['../mcp-servers/wolfkrow-agents/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'wolfkrow-skills',
    description: 'Internal skills',
    command: 'node',
    args: ['../mcp-servers/wolfkrow-skills/dist/index.js'] as string[],
    visibility: 'always' as const,
  },
  {
    name: 'wolfkrow-user-question',
    description: 'User question MCP',
    command: 'node',
    args: ['../mcp-servers/wolfkrow-user-question/dist/index.js'] as string[],
    visibility: 'on-demand' as const,
  },
] as const;
