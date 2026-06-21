/**
 * MGraph — Knowledge graph persistence + neighborhood queries.
 *
 * Wraps graphNodes + graphEdges Drizzle tables. DB is injected so the class
 * is testable with an in-memory SQLite instance and never opens a real
 * connection at import time (see S.5 review: lazy, no eager singleton).
 */

import { randomUUID } from 'crypto';


import { getDb } from '@wolfkrow/infra/db/client';
import { graphNodes, graphEdges } from '@wolfkrow/infra/db/schema';
import { and, eq, inArray, or } from 'drizzle-orm';

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
    const node: GraphNode = {
      id: randomUUID(),
      userId: input.userId,
      label: input.label,
      type: input.type,
      sourceId: input.sourceId ?? null,
      createdAt: now,
    };
    this.db.insert(graphNodes).values(node).run();
    return node;
  }

  upsertEdge(input: {
    userId: string;
    sourceNodeId: string;
    targetNodeId: string;
    relation?: string;
    weight?: number;
  }): GraphEdge {
    const relation = input.relation ?? 'related';
    const existing = this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, input.userId),
          eq(graphEdges.sourceNodeId, input.sourceNodeId),
          eq(graphEdges.targetNodeId, input.targetNodeId),
          eq(graphEdges.relation, relation),
        ),
      )
      .get();

    if (existing) return existing as GraphEdge;

    const now = new Date();
    const edge: GraphEdge = {
      id: randomUUID(),
      userId: input.userId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relation,
      weight: input.weight ?? 1.0,
      createdAt: now,
    };
    this.db.insert(graphEdges).values(edge).run();
    return edge;
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

  getNode(userId: string, nodeId: string): GraphNode | null {
    const node = this.db
      .select()
      .from(graphNodes)
      .where(and(eq(graphNodes.id, nodeId), eq(graphNodes.userId, userId)))
      .get() as GraphNode | undefined;
    return node ?? null;
  }

  /**
   * Neighborhood via breadth-first expansion up to `depth` hops.
   * Implements QueryNeighborhood (depth=1) and ExpandNode (depth>1).
   */
  neighborhood(userId: string, nodeId: string, depth = 1): GraphNeighborhood | null {
    const center = this.getNode(userId, nodeId);
    if (!center) return null;

    const visitedIds = this.reachableIds(userId, nodeId, depth);
    const neighborIds = visitedIds.filter((id) => id !== nodeId);
    const neighbors = this.nodesByIds(neighborIds);
    const edges = this.edgesAmong(userId, visitedIds);
    return { center, neighbors, edges };
  }

  /** SPEC-022 ExpandNode — alias for neighborhood expansion. */
  expand(userId: string, nodeId: string, depth = 1): GraphNeighborhood | null {
    return this.neighborhood(userId, nodeId, depth);
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

  /** One BFS hop: returns the next frontier from edges touching `frontier`. */
  private expandFrontier(userId: string, frontier: string[], visited: Set<string>): string[] {
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
    return this.db.select().from(graphNodes).where(inArray(graphNodes.id, ids)).all() as GraphNode[];
  }

  /** Edges whose endpoints both fall within `ids`, scoped to user. */
  private edgesAmong(userId: string, ids: string[]): GraphEdge[] {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(graphEdges)
      .where(
        and(
          eq(graphEdges.userId, userId),
          or(
            inArray(graphEdges.sourceNodeId, ids),
            inArray(graphEdges.targetNodeId, ids),
          ),
        ),
      )
      .all() as GraphEdge[];
  }

  /** Returns true if a node existed and was deleted. */
  deleteNode(userId: string, nodeId: string): boolean {
    const existed = this.getNode(userId, nodeId) !== null;
    if (!existed) return false;

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
    return true;
  }
}
