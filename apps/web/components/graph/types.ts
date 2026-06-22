/**
 * Shared graph types — API wire format (Dates serialized as strings).
 * Backend domain types (`@wolfkrow/domain` GraphNode/Edge) use Date; these
 * mirror the JSON shape returned by /graph routes.
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
