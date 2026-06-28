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
 * (/ - every entry in BUILT_IN_MCP_SERVERS now resolves to a real
 * binary. Previously all 18 pointed at non-existent dist files.)
 */

export interface BuiltInMcpEntry {
  name: string;
  description: string;
  command: string;
  args: string[];
  visibility: 'always' | 'on-demand';
}

const DIST = (name: string): string[] => [`../mcp-servers/${name}/dist/index.js`];

export const BUILT_IN_MCP_SERVERS: readonly BuiltInMcpEntry[] = [
  {
    name: 'graph-search',
    description: 'Knowledge graph search (neighborhood + full graph)',
    command: 'node',
    args: DIST('graph-search'),
    visibility: 'always',
  },
  {
    name: 'wolfkrow-skills',
    description: 'List skills available to the user',
    command: 'node',
    args: DIST('wolfkrow-skills'),
    visibility: 'always',
  },
  {
    name: 'knowledge-base',
    description: 'Semantic search over the knowledge base',
    command: 'node',
    args: DIST('knowledge-base'),
    visibility: 'always',
  },
  {
    name: 'memory-search',
    description: 'Semantic search + CRUD over Wolfkrow memory (bridges to /api/memory)',
    command: 'node',
    args: DIST('memory-search'),
    visibility: 'always',
  },
  {
    name: 'local-agents',
    description: 'List/create/get/delete Wolfkrow agents (bridges to /api/agents on web)',
    command: 'node',
    args: DIST('local-agents'),
    visibility: 'always',
  },
  {
    name: 'local-llm',
    description:
      'Ollama local LLM - list/show/chat (requires OLLAMA_HOST, default localhost:11434)',
    command: 'node',
    args: DIST('local-llm'),
    visibility: 'on-demand',
  },
  {
    name: 'youtube',
    description: 'YouTube video search and transcript extraction (requires YOUTUBE_API_KEY)',
    command: 'node',
    args: DIST('youtube'),
    visibility: 'on-demand',
  },
  {
    name: 'google-calendar',
    description: 'Google Calendar - list and create events (requires GOOGLE_CALENDAR_TOKEN)',
    command: 'node',
    args: DIST('google-calendar'),
    visibility: 'on-demand',
  },
  {
    name: 'google-gmail',
    description: 'Gmail - search and read messages (requires GOOGLE_GMAIL_TOKEN)',
    command: 'node',
    args: DIST('google-gmail'),
    visibility: 'on-demand',
  },
  {
    name: 'google-drive',
    description: 'Google Drive - list/get/share files (requires GOOGLE_DRIVE_TOKEN)',
    command: 'node',
    args: DIST('google-drive'),
    visibility: 'on-demand',
  },
  {
    name: 'google-sheets',
    description: 'Google Sheets - list/read/append (requires GOOGLE_SHEETS_TOKEN)',
    command: 'node',
    args: DIST('google-sheets'),
    visibility: 'on-demand',
  },
  {
    name: 'elevenlabs',
    description: 'ElevenLabs text-to-speech (requires ELEVENLABS_API_KEY + voice_id)',
    command: 'node',
    args: DIST('elevenlabs'),
    visibility: 'on-demand',
  },
  {
    name: 'excalidraw',
    description: 'Generate Excalidraw scene JSON for flow/sequence/mindmap diagrams',
    command: 'node',
    args: DIST('excalidraw'),
    visibility: 'on-demand',
  },
  {
    name: 'shopify',
    description:
      'Shopify Admin API - list/get/count products (requires SHOPIFY_SHOP + SHOPIFY_ADMIN_TOKEN)',
    command: 'node',
    args: DIST('shopify'),
    visibility: 'on-demand',
  },
  {
    name: 'nano-banana',
    description: 'Image generation via nano-banana (requires NANO_BANANA_API_KEY)',
    command: 'node',
    args: DIST('nano-banana'),
    visibility: 'on-demand',
  },
] as const;

/**
 * Roadmap of MCP servers not yet bundled. Listed for visibility only - never
 * seeded and never spawned (no binary exists). When one is implemented in
 * `packages/mcp-servers/<name>/`, move its entry into BUILT_IN_MCP_SERVERS.
 */
export const PLANNED_MCP_SERVERS: readonly BuiltInMcpEntry[] = [
  {
    name: 'skills',
    description: 'Skills MCP server (alias for wolfkrow-skills)',
    command: 'node',
    args: [],
    visibility: 'always',
  },
  {
    name: 'wolfkrow-agents',
    description: 'Internal agents (alias for local-agents)',
    command: 'node',
    args: [],
    visibility: 'always',
  },
  {
    name: 'wolfkrow-user-question',
    description: 'User question MCP',
    command: 'node',
    args: [],
    visibility: 'on-demand',
  },
] as const;
