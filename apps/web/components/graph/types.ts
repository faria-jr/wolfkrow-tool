/**
 * Shared graph types — mirror the worker MGraph schema (SPEC-022).
 */

export type NodeType = 'document' | 'entity' | 'concept' | 'memory';

export interface GraphNode {
  id: string;
  userId: string;
  label: string;
  type: NodeType;
  sourceId: string | null;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
  weight: number;
  createdAt: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNeighborhood {
  center: GraphNode;
  neighbors: GraphNode[];
  edges: GraphEdge[];
}
