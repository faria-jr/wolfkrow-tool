/**
 * GraphIngest — extracts named entities and relations from plain text,
 * then persists them to the knowledge graph via MGraph.
 *
 * Uses lightweight heuristics (regex + NLP-lite patterns) rather than
 * a heavy ML model, so it runs entirely offline without a GPU.
 *
 * MGraph is injected so the ingest pipeline is testable without a global
 * singleton (see S.5 review).
 */

import type { GraphNode, MGraph, NodeType } from './mgraph';

export interface IngestInput {
  userId: string;
  text: string;
  sourceId?: string;
  sourceLabel?: string;
}

export interface IngestResult {
  documentNode: GraphNode;
  entityNodes: GraphNode[];
  /** Honest count of edges persisted for this document (mentions + co-occurs). */
  edgeCount: number;
}

/** Token-window within which two entities are considered co-occurring. */
const COOCCUR_WINDOW = 8;

// Words to skip when identifying entities
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'that', 'this', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his',
]);

// Patterns for known concept types
const TECH_TERMS = /\b(API|REST|GraphQL|HTTP|SQL|JSON|XML|CSV|PDF|URL|URI|JWT|OAuth|CORS|CDN|DNS|TLS|SSL|TCP|IP|SDK|CLI|IDE|CI|CD|AWS|GCP|Azure)\b/g;

/** Split text into lowercased alphanumeric tokens with their index. */
export function tokenize(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

/** First token index where `label` occurs (single word or multi-word phrase). */
export function findFirstPosition(tokens: string[], label: string): number {
  const words = label.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return -1;
  for (let i = 0; i <= tokens.length - words.length; i++) {
    let match = true;
    for (let j = 0; j < words.length; j++) {
      if (tokens[i + j] !== words[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

export function extractProperNouns(text: string): string[] {
  // Capitalised words not in STOP_WORDS. Includes sentence-initial words so
  // entities that open a sentence (e.g. "Alice met Bob") are not lost; common
  // sentence starters are filtered via STOP_WORDS.
  const words: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const raw = (tokens[i] ?? '').replace(/[^a-zA-Z0-9]/g, '');
      if (raw.length > 2 && /^[A-Z]/.test(raw) && !STOP_WORDS.has(raw.toLowerCase())) {
        words.push(raw);
      }
    }
  }
  return [...new Set(words)];
}

export function extractTechTerms(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TECH_TERMS.source, 'g');
  while ((m = re.exec(text)) !== null) {
    matches.push(m[0]!);
  }
  return [...new Set(matches)];
}

export function extractKeyPhrases(text: string): string[] {
  // noun-phrase heuristic: 2 consecutive non-stop words
  const phrases: string[] = [];
  const tokens = text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i] ?? '';
    const b = tokens[i + 1] ?? '';
    const pair = `${a} ${b}`;
    if (
      pair.length > 5 &&
      pair.length < 40 &&
      !STOP_WORDS.has(a.toLowerCase()) &&
      !STOP_WORDS.has(b.toLowerCase())
    ) {
      phrases.push(pair);
    }
  }
  return [...new Set(phrases)].slice(0, 20);
}

interface PositionedEntity {
  label: string;
  type: Exclude<NodeType, 'document' | 'memory'>;
  position: number;
}

/**
 * Build the deduplicated entity list with each entity's first token position
 * in the source text. Position -1 means the entity was not found in the
 * token stream (it is still ingested but excluded from co-occurrence edges).
 */
export function buildEntities(text: string): PositionedEntity[] {
  const tokens = tokenize(text);
  const seen = new Set<string>();
  const out: PositionedEntity[] = [];

  const add = (label: string, type: 'entity' | 'concept') => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, type, position: findFirstPosition(tokens, label) });
  };

  for (const noun of extractProperNouns(text)) add(noun, 'entity');
  for (const term of extractTechTerms(text)) add(term, 'concept');
  for (const phrase of extractKeyPhrases(text)) add(phrase, 'concept');

  return out;
}

/**
 * Compute co-occurrence pairs from entity text positions.
 * Two entities co-occur when their first token positions are within
 * COOCCUR_WINDOW tokens of each other. Weight = 1 / distance.
 */
export function computeCooccurrence(
  entities: PositionedEntity[],
  window = COOCCUR_WINDOW,
): Array<{ a: string; b: string; weight: number }> {
  const positioned = entities.filter((e) => e.position >= 0);
  const pairs: Array<{ a: string; b: string; weight: number }> = [];
  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const dist = Math.abs(positioned[i]!.position - positioned[j]!.position);
      if (dist > 0 && dist <= window) {
        pairs.push({
          a: positioned[i]!.label,
          b: positioned[j]!.label,
          weight: 1 / dist,
        });
      }
    }
  }
  return pairs;
}

export class GraphIngest {
  constructor(private readonly graph: MGraph) {}

  ingest(input: IngestInput): IngestResult {
    const { userId, text, sourceId, sourceLabel } = input;

    const docLabel = sourceLabel ?? (sourceId ? `doc:${sourceId}` : `text:${text.slice(0, 40)}`);
    const documentNode = this.graph.upsertNode({
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
      // sourceId back-references the originating document node so an entity
      // can be traced to its source directly (SPEC-022 US-3).
      const node = this.graph.upsertNode({
        userId,
        label: e.label,
        type: e.type,
        sourceId: documentNode.id,
      });
      entityNodes.push(node);
      labelToNode.set(e.label, node);
      this.graph.upsertEdge({
        userId,
        sourceNodeId: documentNode.id,
        targetNodeId: node.id,
        relation: 'mentions',
      });
      mentionsEdges++;
    }

    const pairs = computeCooccurrence(entities);
    let cooccurEdges = 0;
    for (const p of pairs) {
      const a = labelToNode.get(p.a);
      const b = labelToNode.get(p.b);
      if (!a || !b) continue;
      this.graph.upsertEdge({
        userId,
        sourceNodeId: a.id,
        targetNodeId: b.id,
        relation: 'co-occurs',
        weight: p.weight,
      });
      cooccurEdges++;
    }

    const edgeCount = mentionsEdges + cooccurEdges;

    return { documentNode, entityNodes, edgeCount };
  }
}
