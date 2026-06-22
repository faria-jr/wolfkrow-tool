import type {
  McpServerCreateInput,
  McpServerRecord,
  McpServerRepo,
  McpServerVisibility,
} from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { mcpServers } from '../db/schema/mcp-servers';

type McpServerRow = typeof mcpServers.$inferSelect;
type Db = ReturnType<typeof getDb>;

/**
 * MCP-server repository via Drizzle (SQLite). Implementa o port `McpServerRepo`
 * do domínio (FIX-027: tipos eram inline em infra).
 */
export class DrizzleMcpServerRepo implements McpServerRepo {
  constructor(private readonly db: Db = getDb()) {}

  findById(id: string): McpServerRecord | null {
    const rows = this.db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1).all();
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  findByName(name: string): McpServerRecord | null {
    const rows = this.db.select().from(mcpServers).where(eq(mcpServers.name, name)).limit(1).all();
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  findActive(): McpServerRecord[] {
    return this.db.select().from(mcpServers).where(eq(mcpServers.isActive, true)).all().map((r) => this.toRecord(r));
  }

  findAll(userId?: string): McpServerRecord[] {
    const rows = userId
      ? this.db.select().from(mcpServers).where(eq(mcpServers.userId, userId)).all()
      : this.db.select().from(mcpServers).all();
    return rows.map((r) => this.toRecord(r));
  }

  save(id: string, input: McpServerCreateInput): McpServerRecord {
    const now = new Date();
    const row = { id, ...this.toInsertFields(input), createdAt: now, updatedAt: now };
    this.db.insert(mcpServers).values(row).onConflictDoUpdate({
      target: mcpServers.id,
      set: { ...this.toInsertFields(input), updatedAt: now },
    }).run();
    const fetched = this.db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1).all();
    return this.toRecord(fetched[0]!);
  }

  toggleActive(id: string, isActive: boolean): void {
    this.db.update(mcpServers).set({ isActive, updatedAt: new Date() }).where(eq(mcpServers.id, id)).run();
  }

  delete(id: string): void {
    this.db.delete(mcpServers).where(eq(mcpServers.id, id)).run();
  }

  private toInsertFields(input: McpServerCreateInput) {
    return {
      userId: input.userId,
      name: input.name,
      command: input.command,
      args: [...input.args],
      env: { ...input.env },
      isActive: input.isActive,
      isBuiltIn: input.isBuiltIn,
      visibility: input.visibility as McpServerVisibility,
      metadata: {},
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.healthCheck !== undefined ? { healthCheck: input.healthCheck } : {}),
    };
  }

  private toRecord(row: McpServerRow): McpServerRecord {
    return {
      id: row.id,
      userId: row.userId ?? null,
      name: row.name,
      description: row.description ?? undefined,
      command: row.command,
      args: Array.isArray(row.args) ? row.args : [],
      env: (row.env ?? {}) as Record<string, string>,
      isActive: row.isActive,
      isBuiltIn: row.isBuiltIn,
      visibility: row.visibility as McpServerVisibility,
      healthCheck: row.healthCheck ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
