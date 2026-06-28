import { randomUUID } from 'node:crypto';

import type {
  GraphEdge,
  GraphEdgeUpsertInput,
  GraphNeighborhood,
  GraphNode,
  GraphNodeUpsertInput,
  GraphRepo,
  NodeType,
} from '@wolfkrow/domain';
import { and, eq, inArray, or } from 'drizzle-orm';

import { getDb } from '../db/client';
import { graphEdges, graphNodes } from '../db/schema/graph';

type Db = ReturnType<typeof getDb>;

/**
 * Knowledge-graph repository via Drizzle (SQLite). Implementa o port `GraphRepo`
 * do domínio (antes era o adapter `MGraph` em apps/worker/src/knowledge,
 * com tipos de domínio definidos fora do domínio).
 */
export class DrizzleGraphRepo implements GraphRepo {
  constructor(private readonly db: Db = getDb()) {}

  upsertNode(input: GraphNodeUpsertInput): GraphNode {
    const existing = this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, input.userId),
          eq(graphNodes.label, input.label),
          eq(graphNodes.type, input.type as never)
        )
      )
      .get();
    if (existing) return this.toNode(existing);

    const node = {
      id: randomUUID(),
      userId: input.userId,
      label: input.label,
      type: input.type,
      sourceId: input.sourceId ?? null,
      createdAt: new Date(),
    };
    this.db.insert(graphNodes).values(node).run();
    return this.toNode(node);
  }

  upsertEdge(input: GraphEdgeUpsertInput): GraphEdge {
    const relation = input.relation ?? 'related';
    const existing = this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, input.userId),
          eq(graphEdges.sourceNodeId, input.sourceNodeId),
          eq(graphEdges.targetNodeId, input.targetNodeId),
          eq(graphEdges.relation, relation)
        )
      )
      .get();
    if (existing) return this.toEdge(existing);

    const edge = {
      id: randomUUID(),
      userId: input.userId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relation,
      weight: input.weight ?? 1.0,
      createdAt: new Date(),
    };
    this.db.insert(graphEdges).values(edge).run();
    return this.toEdge(edge);
  }

  listNodes(userId: string): GraphNode[] {
    return this.db
      .select()
      .from(graphNodes)
      .where(eq(graphNodes.userId, userId))
      .all()
      .map(this.toNode);
  }

  listEdges(userId: string): GraphEdge[] {
    return this.db
      .select()
      .from(graphEdges)
      .where(eq(graphEdges.userId, userId))
      .all()
      .map(this.toEdge);
  }

  getNode(userId: string, nodeId: string): GraphNode | null {
    const node = this.db
      .select()
      .from(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, userId)))
      .get();
    return node ? this.toNode(node) : null;
  }

  neighborhood(userId: string, nodeId: string, depth = 1): GraphNeighborhood | null {
    const center = this.getNode(userId, nodeId);
    if (!center) return null;

    const visitedIds = this.reachableIds(userId, nodeId, depth);
    const neighborIds = visitedIds.filter((id) => id !== nodeId);
    const neighbors = this.nodesByIds(neighborIds);
    const edges = this.edgesAmong(userId, visitedIds);
    return { center, neighbors, edges };
  }

  deleteNode(userId: string, nodeId: string): boolean {
    if (this.getNode(userId, nodeId) === null) return false;
    this.db
      .delete(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(eq(graphEdges.sourceNodeId, nodeId), eq(graphEdges.targetNodeId, nodeId))
        )
      )
      .run();
    this.db
      .delete(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, userId)))
      .run();
    return true;
  }

  /** BFS from `nodeId`, returning all reachable node ids (including it). */
  private reachableIds(userId: string, nodeId: string, depth: number): string[] {
    const visited = new Set<string>([nodeId]);
    let frontier = [nodeId];
    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break;
      frontier = this.expandFrontier(userId, frontier, visited);
    }
    return Array.from(visited);
  }

  private expandFrontier(userId: string, frontier: string[], visited: Set<string>): string[] {
    const edges = this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(inArray(graphEdges.sourceNodeId, frontier), inArray(graphEdges.targetNodeId, frontier))
        )
      )
      .all();
    const next: string[] = [];
    for (const e of edges) {
      for (const endpoint of [e.sourceNodeId, e.targetNodeId]) {
        if (!visited.has(endpoint)) {
          visited.add(endpoint);
          next.push(endpoint);
        }
      }
    }
    return next;
  }

  private nodesByIds(ids: string[]): GraphNode[] {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(graphNodes)
      .where(inArray(graphNodes.id, ids))
      .all()
      .map(this.toNode);
  }

  private edgesAmong(userId: string, ids: string[]): GraphEdge[] {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(inArray(graphEdges.sourceNodeId, ids), inArray(graphEdges.targetNodeId, ids))
        )
      )
      .all()
      .map(this.toEdge);
  }

  private toNode = (r: typeof graphNodes.$inferSelect): GraphNode => ({
    id: r.id,
    userId: r.userId,
    label: r.label,
    type: r.type as NodeType,
    sourceId: r.sourceId ?? null,
    createdAt: r.createdAt,
  });

  private toEdge = (r: typeof graphEdges.$inferSelect): GraphEdge => ({
    id: r.id,
    userId: r.userId,
    sourceNodeId: r.sourceNodeId,
    targetNodeId: r.targetNodeId,
    relation: r.relation,
    weight: r.weight,
    createdAt: r.createdAt,
  });
}
