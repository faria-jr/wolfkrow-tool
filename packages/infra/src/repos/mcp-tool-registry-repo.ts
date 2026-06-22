import { randomUUID } from 'node:crypto';

import type { McpToolInput, McpToolRecord, McpToolRegistryRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { mcpToolRegistry } from '../db/schema/mcp-servers';

/**
 * MCP tool-registry repository via Drizzle (SQLite). Implementa o port
 * `McpToolRegistryRepo` do domínio (FIX-027: contrato era inline em infra).
 */
export class DrizzleMcpToolRegistryRepo implements McpToolRegistryRepo {
  constructor(private readonly db = getDb()) {}

  upsertMany(serverId: string, tools: McpToolInput[]): void {
    const now = new Date();
    for (const tool of tools) {
      const existing = this.db
        .select()
        .from(mcpToolRegistry)
        .where(eq(mcpToolRegistry.mcpServerId, serverId))
        .all()
        .find((r) => r.name === tool.name);

      if (existing) {
        this.db
          .update(mcpToolRegistry)
          .set({ description: tool.description ?? null, inputSchema: tool.inputSchema ?? null, lastSynced: now })
          .where(eq(mcpToolRegistry.id, existing.id))
          .run();
      } else {
        this.db
          .insert(mcpToolRegistry)
          .values({
            id: randomUUID(),
            mcpServerId: serverId,
            name: tool.name,
            description: tool.description ?? null,
            inputSchema: tool.inputSchema ?? null,
            lastSynced: now,
          })
          .run();
      }
    }
  }

  findByServerId(serverId: string): McpToolRecord[] {
    return this.db
      .select()
      .from(mcpToolRegistry)
      .where(eq(mcpToolRegistry.mcpServerId, serverId))
      .all()
      .map(this.toRecord);
  }

  deleteByServerId(serverId: string): void {
    this.db.delete(mcpToolRegistry).where(eq(mcpToolRegistry.mcpServerId, serverId)).run();
  }

  private toRecord = (r: typeof mcpToolRegistry.$inferSelect): McpToolRecord => ({
    id: r.id,
    mcpServerId: r.mcpServerId,
    name: r.name,
    description: r.description ?? undefined,
    inputSchema: (r.inputSchema as Record<string, unknown> | null) ?? undefined,
    lastSynced: r.lastSynced,
  });
}
