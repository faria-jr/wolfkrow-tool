import { Agent, type AgentRepo } from '@wolfkrow/domain';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client';
import { agents } from '../db/schema/agents';

type AgentRow = typeof agents.$inferSelect;
type Db = ReturnType<typeof getDb>;

export class DrizzleAgentRepo implements AgentRepo {
  constructor(private readonly db: Db = getDb()) {}

  async findById(id: string): Promise<Agent | null> {
    const rows = this.db.select().from(agents).where(eq(agents.id, id)).limit(1).all();
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const rows = this.db.select().from(agents).where(eq(agents.userId, userId)).all();
    return rows.map((r) => this.toEntity(r));
  }

  async findActiveByUserId(userId: string): Promise<Agent[]> {
    const rows = this.db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId))
      .all()
      .filter((r) => r.isActive);
    return rows.map((r) => this.toEntity(r));
  }

  async save(agent: Agent): Promise<Agent> {
    const now = new Date();
    const insertRow = this.toInsertRow(agent, now);
    const updateSet = this.toUpdateSet(agent, now);
    this.db
      .insert(agents)
      .values(insertRow)
      .onConflictDoUpdate({ target: agents.id, set: updateSet })
      .run();
    return agent;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(agents).where(eq(agents.id, id)).run();
  }

  private toInsertRow(agent: Agent, now: Date) {
    return {
      id: agent.id,
      userId: agent.userId,
      name: agent.name,
      model: agent.model,
      effort: agent.effort,
      thinking: agent.thinking,
      maxTurns: agent.maxTurns,
      allowedTools: [...agent.allowedTools],
      mcpServers: [...agent.mcpServers],
      isActive: agent.isActive,
      skills: [...agent.skills],
      runtime: agent.runtime,
      provider: agent.provider ?? null,
      systemPrompt: agent.systemPrompt ?? '',
      metadata: {} as Record<string, unknown>,
      createdAt: agent.createdAt,
      updatedAt: now,
      ...(agent.description !== undefined ? { description: agent.description } : {}),
      ...(agent.thinkingBudget !== undefined ? { thinkingBudget: agent.thinkingBudget } : {}),
      ...(agent.squad !== undefined ? { squad: agent.squad } : {}),
    };
  }

  private toUpdateSet(agent: Agent, now: Date) {
    return {
      userId: agent.userId,
      name: agent.name,
      model: agent.model,
      effort: agent.effort,
      thinking: agent.thinking,
      maxTurns: agent.maxTurns,
      allowedTools: [...agent.allowedTools],
      mcpServers: [...agent.mcpServers],
      isActive: agent.isActive,
      skills: [...agent.skills],
      runtime: agent.runtime,
      provider: agent.provider ?? null,
      systemPrompt: agent.systemPrompt ?? '',
      metadata: {} as Record<string, unknown>,
      updatedAt: now,
      ...(agent.description !== undefined ? { description: agent.description } : {}),
      ...(agent.thinkingBudget !== undefined ? { thinkingBudget: agent.thinkingBudget } : {}),
      ...(agent.squad !== undefined ? { squad: agent.squad } : {}),
    };
  }

  private toEntity(row: AgentRow): Agent {
    return Agent.fromProps({
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? undefined,
      model: row.model,
      effort: row.effort,
      thinking: row.thinking,
      thinkingBudget: row.thinkingBudget ?? undefined,
      maxTurns: row.maxTurns,
      allowedTools: row.allowedTools,
      mcpServers: row.mcpServers,
      isActive: row.isActive,
      skills: row.skills,
      runtime: row.runtime,
      provider: row.provider ?? undefined,
      squad: row.squad ?? undefined,
      systemPrompt: row.systemPrompt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
