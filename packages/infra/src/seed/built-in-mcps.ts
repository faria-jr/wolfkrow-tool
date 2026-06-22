/**
 * Built-in MCP servers.
 *
 * `BUILT_IN_MCP_SERVERS` lists the servers that are actually bundled and
 * buildable in `packages/mcp-servers/`. They are seeded into the DB and
 * auto-started (visibility 'always') by the worker on boot. Each `args` path
 * points at a real `dist/index.js` produced by the matching workspace package.
 *
 * `PLANNED_MCP_SERVERS` is a non-seeded roadmap of integrations that have no
 * bundled binary yet. They are kept here (and excluded from seeding) so the
 * catalog/UI can surface them as "not yet available" instead of spawning a
 * process that is guaranteed to ENOENT.
 *
 * (FIX-006 / G9 — every entry in BUILT_IN_MCP_SERVERS now resolves to a real
 * binary. Previously all 18 pointed at non-existent dist files.)
 */

export interface BuiltInMcpEntry {
  name: string;
  description: string;
  command: string;
  args: string[];
  visibility: 'always' | 'on-demand';
}

export const BUILT_IN_MCP_SERVERS: readonly BuiltInMcpEntry[] = [
  {
    name: 'graph-search',
    description: 'Knowledge graph search (neighborhood + full graph)',
    command: 'node',
    args: ['../mcp-servers/graph-search/dist/index.js'],
    visibility: 'always',
  },
  {
    name: 'wolfkrow-skills',
    description: 'List skills available to the user',
    command: 'node',
    args: ['../mcp-servers/wolfkrow-skills/dist/index.js'],
    visibility: 'always',
  },
  {
    name: 'knowledge-base',
    description: 'Semantic search over the knowledge base',
    command: 'node',
    args: ['../mcp-servers/knowledge-base/dist/index.js'],
    visibility: 'always',
  },
] as const;

/**
 * Roadmap of MCP servers not yet bundled. Listed for visibility only — never
 * seeded and never spawned (no binary exists). When one is implemented in
 * `packages/mcp-servers/<name>/`, move its entry into BUILT_IN_MCP_SERVERS.
 */
export const PLANNED_MCP_SERVERS: readonly BuiltInMcpEntry[] = [
  { name: 'google-calendar', description: 'Google Calendar API integration', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'google-gmail', description: 'Gmail API integration', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'google-drive', description: 'Google Drive API integration', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'google-sheets', description: 'Google Sheets API integration', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'elevenlabs', description: 'ElevenLabs text-to-speech', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'excalidraw', description: 'Excalidraw drawing integration', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'memory-search', description: 'Semantic search over agent memory', command: 'node', args: [], visibility: 'always' },
  { name: 'local-agents', description: 'Local agent runner', command: 'node', args: [], visibility: 'always' },
  { name: 'local-llm', description: 'Ollama local LLM', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'skills', description: 'Skills MCP server', command: 'node', args: [], visibility: 'always' },
  { name: 'youtube', description: 'YouTube transcript extraction', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'shopify', description: 'Shopify e-commerce API', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'nano-banana', description: 'Cohere LLM', command: 'node', args: [], visibility: 'on-demand' },
  { name: 'wolfkrow-agents', description: 'Internal agents', command: 'node', args: [], visibility: 'always' },
  { name: 'wolfkrow-user-question', description: 'User question MCP', command: 'node', args: [], visibility: 'on-demand' },
] as const;
