/**
 * MGraph — Knowledge graph persistence + neighborhood queries.
 *
 * Wraps graphNodes + graphEdges Drizzle tables.
 */

import { randomUUID } from 'crypto';
import { eq, and, or, inArray } from 'drizzle-orm';

import { getDb } from '@wolfkrow/infra/db/client';
import { graphNodes, graphEdges } from '@wolfkrow/infra/db/schema';

export type NodeType = 'document' | 'entity' | 'concept' | 'memory';

export interface GraphNode {
  id: string;
  userId: string;
  label: string;
  type: NodeType;
  sourceId: string | null;
  createdAt: Date;
}

export interface GraphEdge {
  id: string;
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
  weight: number;
  createdAt: Date;
}

export interface GraphNeighborhood {
  center: GraphNode;
  neighbors: GraphNode[];
  edges: GraphEdge[];
}

export class MGraph {
  constructor(private readonly db = getDb()) {}

  upsertNode(input: {
    userId: string;
    label: string;
    type: NodeType;
    sourceId?: string;
  }): GraphNode {
    const existing = this.db
      .select()
      .from(graphNodes)
      .where(
        and(
          eq(graphNodes.userId, input.userId),
          eq(graphNodes.label, input.label),
          eq(graphNodes.type, input.type),
        ),
      )
      .get();

    if (existing) return existing as GraphNode;

    const now = new Date();
    const node = {
      id: randomUUID(),
      userId: input.userId,
      label: input.label,
      type: input.type,
      sourceId: input.sourceId ?? null,
      createdAt: now,
    };
    this.db.insert(graphNodes).values(node).run();
    return node as GraphNode;
  }

  upsertEdge(input: {
    userId: string;
    sourceNodeId: string;
    targetNodeId: string;
    relation?: string;
    weight?: number;
  }): GraphEdge {
    const existing = this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, input.userId),
          eq(graphEdges.sourceNodeId, input.sourceNodeId),
          eq(graphEdges.targetNodeId, input.targetNodeId),
          eq(graphEdges.relation, input.relation ?? 'related'),
        ),
      )
      .get();

    if (existing) return existing as GraphEdge;

    const now = new Date();
    const edge = {
      id: randomUUID(),
      userId: input.userId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relation: input.relation ?? 'related',
      weight: input.weight ?? 1.0,
      createdAt: now,
    };
    this.db.insert(graphEdges).values(edge).run();
    return edge as GraphEdge;
  }

  listNodes(userId: string): GraphNode[] {
    return this.db
      .select()
      .from(graphNodes)
      .where(eq(graphNodes.userId, userId))
      .all() as GraphNode[];
  }

  listEdges(userId: string): GraphEdge[] {
    return this.db
      .select()
      .from(graphEdges)
      .where(eq(graphEdges.userId, userId))
      .all() as GraphEdge[];
  }

  neighborhood(userId: string, nodeId: string, depth = 1): GraphNeighborhood | null {
    const center = this.db
      .select()
      .from(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, userId)))
      .get() as GraphNode | undefined;

    if (!center) return null;

    const visitedIds = new Set<string>([nodeId]);
    const frontier = [nodeId];

    for (let d = 0; d < depth; d++) {
      const edges = this.db
        .select()
        .from(graphEdges)
        .where(
          and(
            eq(graphEdges.userId, userId),
            or(
              inArray(graphEdges.sourceNodeId, frontier),
              inArray(graphEdges.targetNodeId, frontier),
            ),
          ),
        )
        .all();

      const next: string[] = [];
      for (const e of edges) {
        if (!visitedIds.has(e.sourceNodeId)) { visitedIds.add(e.sourceNodeId); next.push(e.sourceNodeId); }
        if (!visitedIds.has(e.targetNodeId)) { visitedIds.add(e.targetNodeId); next.push(e.targetNodeId); }
      }
      frontier.splice(0, frontier.length, ...next);
      if (frontier.length === 0) break;
    }

    const neighborIds = Array.from(visitedIds).filter((id) => id !== nodeId);

    const neighbors = neighborIds.length > 0
      ? (this.db.select().from(graphNodes).where(inArray(graphNodes.id, neighborIds)).all() as GraphNode[])
      : [];

    const allIds = Array.from(visitedIds);
    const edges = this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(
            inArray(graphEdges.sourceNodeId, allIds),
            inArray(graphEdges.targetNodeId, allIds),
          ),
        ),
      )
      .all() as GraphEdge[];

    return { center, neighbors, edges };
  }

  deleteNode(userId: string, nodeId: string): void {
    this.db
      .delete(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(eq(graphEdges.sourceNodeId, nodeId), eq(graphEdges.targetNodeId, nodeId)),
        ),
      )
      .run();
    this.db
      .delete(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, userId)))
      .run();
  }
}

export const mgraph = new MGraph();
