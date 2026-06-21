import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { mcpToolRegistry } from '../db/schema/mcp-servers';

export interface McpToolRecord {
  id: string;
  mcpServerId: string;
  name: string;
  description: string | undefined;
  inputSchema: Record<string, unknown> | undefined;
  lastSynced: Date;
}

export class DrizzleMcpToolRegistryRepo {
  constructor(private readonly db = getDb()) {}

  upsertMany(serverId: string, tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>): void {
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
      .map((r) => ({
        id: r.id,
        mcpServerId: r.mcpServerId,
        name: r.name,
        description: r.description ?? undefined,
        inputSchema: (r.inputSchema as Record<string, unknown> | null) ?? undefined,
        lastSynced: r.lastSynced,
      }));
  }

  deleteByServerId(serverId: string): void {
    this.db.delete(mcpToolRegistry).where(eq(mcpToolRegistry.mcpServerId, serverId)).run();
  }
}
