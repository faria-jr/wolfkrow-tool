/**
 * Port + tipos do knowledge graph .
 *
 * Antes `NodeType`/`GraphNode`/`GraphEdge`/`GraphNeighborhood` e o adapter
 * `MGraph` viviam em `apps/worker/src/knowledge/` — lógica de domínio fora do
 * domínio. Tipos e port movidos para cá; a infra implementa (`DrizzleGraphRepo`).
 */

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

export interface GraphNodeUpsertInput {
  userId: string;
  label: string;
  type: NodeType;
  sourceId?: string;
}

export interface GraphEdgeUpsertInput {
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation?: string;
  weight?: number;
}

export interface GraphRepo {
  upsertNode(input: GraphNodeUpsertInput): GraphNode;
  upsertEdge(input: GraphEdgeUpsertInput): GraphEdge;
  listNodes(userId: string): GraphNode[];
  listEdges(userId: string): GraphEdge[];
  getNode(userId: string, nodeId: string): GraphNode | null;
  /** BFS neighborhood up to `depth` hops. */
  neighborhood(userId: string, nodeId: string, depth?: number): GraphNeighborhood | null;
  /** Returns true if a node existed and was deleted. */
  deleteNode(userId: string, nodeId: string): boolean;
}
