/**
 * Port de repositório de MCP servers (FIX-027).
 *
 * Antes `McpServerRecord`/`McpServerCreateInput` eram tipos inline em infra.
 * Contrato movido para o domínio; `DrizzleMcpServerRepo` o implementa.
 */

export type McpServerVisibility = 'always' | 'on-demand' | 'background';

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
  delete(id: string): void;
}
