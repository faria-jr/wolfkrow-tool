import {
 buildEntities,
 computeCooccurrence,
 type GraphNeighborhood,
 type GraphNode,
 type GraphRepo,
} from '@wolfkrow/domain';

// --- Ingest Graph ---

export interface IngestGraphInput {
 userId: string;
 text: string;
 sourceId?: string;
 sourceLabel?: string;
}

export interface IngestGraphResult {
 documentNode: GraphNode;
 entityNodes: GraphNode[];
 /** Honest count of edges persisted for this document (mentions + co-occurs). */
 edgeCount: number;
}

/**
 * Extracts named entities + relations from text and persists them to the
 * knowledge graph .
 * Pure extraction comes from `@wolfkrow/domain`; persistence goes through the
 * `GraphRepo` port.
 */
export class IngestGraphUseCase {
 constructor(private readonly repo: GraphRepo) {}

 execute(input: IngestGraphInput): IngestGraphResult {
 const { userId, text, sourceId, sourceLabel } = input;

 const docLabel = sourceLabel ?? (sourceId ? `doc:${sourceId}` : `text:${text.slice(0, 40)}`);
 const documentNode = this.repo.upsertNode({
 userId,
 label: docLabel,
 type: 'document',
 ...(sourceId !== undefined ? { sourceId } : {}),
 });

 const entities = buildEntities(text);

 const entityNodes: GraphNode[] = [];
 const labelToNode = new Map<string, GraphNode>();
 let mentionsEdges = 0;

 for (const e of entities) {
 const node = this.repo.upsertNode({
 userId,
 label: e.label,
 type: e.type,
 sourceId: documentNode.id,
 });
 entityNodes.push(node);
 labelToNode.set(e.label, node);
 this.repo.upsertEdge({
 userId,
 sourceNodeId: documentNode.id,
 targetNodeId: node.id,
 relation: 'mentions',
 });
 mentionsEdges++;
 }

 let cooccurEdges = 0;
 for (const p of computeCooccurrence(entities)) {
 const a = labelToNode.get(p.a);
 const b = labelToNode.get(p.b);
 if (!a || !b) continue;
 this.repo.upsertEdge({
 userId,
 sourceNodeId: a.id,
 targetNodeId: b.id,
 relation: 'co-occurs',
 weight: p.weight,
 });
 cooccurEdges++;
 }

 return { documentNode, entityNodes, edgeCount: mentionsEdges + cooccurEdges };
 }
}

// --- Query Neighborhood ---

export interface QueryNeighborhoodInput {
 userId: string;
 nodeId: string;
 depth?: number;
}

export class QueryNeighborhoodUseCase {
 constructor(private readonly repo: GraphRepo) {}

 execute(input: QueryNeighborhoodInput): GraphNeighborhood | null {
 return this.repo.neighborhood(input.userId, input.nodeId, input.depth ?? 1);
 }
}
