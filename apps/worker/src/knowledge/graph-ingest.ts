/**
 * GraphIngest — extracts named entities and relations from plain text,
 * then persists them to the knowledge graph via MGraph.
 *
 * Uses lightweight heuristics (regex + NLP-lite patterns) rather than
 * a heavy ML model, so it runs entirely offline without a GPU.
 */

import { mgraph, type GraphNode } from './mgraph';

export interface IngestInput {
  userId: string;
  text: string;
  sourceId?: string;
  sourceLabel?: string;
}

export interface IngestResult {
  documentNode: GraphNode;
  entityNodes: GraphNode[];
  edgeCount: number;
}

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

function extractProperNouns(text: string): string[] {
  // Capitalised words not at sentence start, not in STOP_WORDS
  const words: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const raw = tokens[i]!.replace(/[^a-zA-Z0-9]/g, '');
      if (raw.length > 2 && /^[A-Z]/.test(raw) && !STOP_WORDS.has(raw.toLowerCase())) {
        words.push(raw);
      }
    }
  }
  return [...new Set(words)];
}

function extractTechTerms(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TECH_TERMS.source, 'g');
  while ((m = re.exec(text)) !== null) {
    matches.push(m[0]!);
  }
  return [...new Set(matches)];
}

function extractKeyPhrases(text: string): string[] {
  // noun-phrase heuristic: 2-3 consecutive capitalised or lowercase words
  const phrases: string[] = [];
  const tokens = text
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (
      pair.length > 5 &&
      pair.length < 40 &&
      !STOP_WORDS.has((tokens[i] ?? '').toLowerCase()) &&
      !STOP_WORDS.has((tokens[i + 1] ?? '').toLowerCase())
    ) {
      phrases.push(pair);
    }
  }
  return [...new Set(phrases)].slice(0, 20);
}

export class GraphIngest {
  ingest(input: IngestInput): IngestResult {
    const { userId, text, sourceId, sourceLabel } = input;

    const docLabel = sourceLabel ?? (sourceId ? `doc:${sourceId}` : `text:${text.slice(0, 40)}`);
    const documentNode = mgraph.upsertNode({
      userId,
      label: docLabel,
      type: 'document',
      ...(sourceId !== undefined ? { sourceId } : {}),
    });

    const properNouns = extractProperNouns(text);
    const techTerms = extractTechTerms(text);
    const phrases = extractKeyPhrases(text);

    const entityNodes: GraphNode[] = [];
    const seen = new Set<string>();

    const addEntity = (label: string, type: 'entity' | 'concept') => {
      if (seen.has(label)) return;
      seen.add(label);
      const node = mgraph.upsertNode({ userId, label, type });
      entityNodes.push(node);
      mgraph.upsertEdge({
        userId,
        sourceNodeId: documentNode.id,
        targetNodeId: node.id,
        relation: 'mentions',
      });
    };

    for (const noun of properNouns) addEntity(noun, 'entity');
    for (const term of techTerms) addEntity(term, 'concept');
    for (const phrase of phrases) addEntity(phrase, 'concept');

    // Co-occurrence edges — entities appearing close to each other
    const ids = entityNodes.map((n) => n.id);
    const windowSize = 5;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < Math.min(i + windowSize, ids.length); j++) {
        mgraph.upsertEdge({
          userId,
          sourceNodeId: ids[i]!,
          targetNodeId: ids[j]!,
          relation: 'co-occurs',
          weight: 1 / (j - i),
        });
      }
    }

    const edgeCount = (entityNodes.length > 0 ? entityNodes.length : 0) +
      Math.max(0, entityNodes.length - 1);

    return { documentNode, entityNodes, edgeCount };
  }
}

export const graphIngest = new GraphIngest();
