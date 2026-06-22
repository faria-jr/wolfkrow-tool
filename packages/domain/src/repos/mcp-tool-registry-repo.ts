/**
 * Port de repositório de MCP tool registry (FIX-027).
 *
 * Antes `McpToolRecord` era um tipo inline em infra; sem port no domínio.
 * O contrato agora vive no domínio; `DrizzleMcpToolRegistryRepo` o implementa.
 */

export interface McpToolRecord {
  id: string;
  mcpServerId: string;
  name: string;
  description: string | undefined;
  inputSchema: Record<string, unknown> | undefined;
  lastSynced: Date;
}

export interface McpToolInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolRegistryRepo {
  upsertMany(serverId: string, tools: McpToolInput[]): void;
  findByServerId(serverId: string): McpToolRecord[];
  deleteByServerId(serverId: string): void;
}
