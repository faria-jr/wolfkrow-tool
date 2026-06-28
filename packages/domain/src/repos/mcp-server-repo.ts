/**
 * Port de repositório de MCP servers .
 *
 * Antes `McpServerRecord`/`McpServerCreateInput` eram tipos inline em infra.
 * Contrato movido para o domínio; `DrizzleMcpServerRepo` o implementa.
 */

export type McpServerVisibility = 'always' | 'on-demand' | 'background';

/**
 * Source of an MCP server entry, as seen by the UI.
 *
 * - `built-in`: bundled binary in `packages/mcp-servers/`, seeded into the DB
 * at install (`isBuiltIn: true`).
 * - `planned`: declared in `PLANNED_MCP_SERVERS` but no binary exists yet
 * (deferred integrations). Surfaced in the UI as "not yet available" but
 * never spawned .
 * - `custom`: user-added via the Add MCP Server modal (`isBuiltIn: false`).
 *
 * The first two are derived; the third is always `isBuiltIn: false`. The
 * catalog lookup is done at the route layer (`built-in-mcps.ts` exports
 * `BUILT_IN_MCP_SERVERS` and `PLANNED_MCP_SERVERS`).
 */
export type McpServerSource = 'built-in' | 'planned' | 'custom';

export interface McpServerRecord {
  id: string;
  userId: string | null;
  name: string;
  description: string | undefined;
  command: string;
  args: string[];
  env: Record<string, string>;
  isActive: boolean;
  isBuiltIn: boolean;
  visibility: McpServerVisibility;
  healthCheck: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpServerCreateInput {
  userId: string | null;
  name: string;
  description?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  isActive: boolean;
  isBuiltIn: boolean;
  visibility: McpServerVisibility;
  healthCheck?: string;
}

export interface McpServerRepo {
  findById(id: string): McpServerRecord | null;
  findByName(name: string): McpServerRecord | null;
  findActive(): McpServerRecord[];
  findAll(userId?: string): McpServerRecord[];
  save(id: string, input: McpServerCreateInput): McpServerRecord;
  toggleActive(id: string, isActive: boolean): void;
  setVisibility(id: string, visibility: McpServerVisibility): void;
  delete(id: string): void;
}
