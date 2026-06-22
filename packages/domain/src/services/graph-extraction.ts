/**
 * Extração de entidades/relações p/ o knowledge graph (FIX-008).
 *
 * Lógica PURA de domínio (heurísticas regex + NLP-lite, sem I/O). Antes vivia
 * em `apps/worker/src/knowledge/graph-ingest.ts`; movida para o domínio onde
 * pertence. O use-case (`IngestGraphUseCase`) consome estas funções + o
 * `GraphRepo` port.
 */

import type { NodeType } from '../repos/graph-repo';

/** Token-window within which two entities are considered co-occurring. */
const COOCCUR_WINDOW = 8;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'that', 'this', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his',
]);

const TECH_TERMS = /\b(API|REST|GraphQL|HTTP|SQL|JSON|XML|CSV|PDF|URL|URI|JWT|OAuth|CORS|CDN|DNS|TLS|SSL|TCP|IP|SDK|CLI|IDE|CI|CD|AWS|GCP|Azure)\b/g;

export interface PositionedEntity {
  label: string;
  type: Exclude<NodeType, 'document' | 'memory'>;
  position: number;
}

export function tokenize(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

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
  const words: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (const token of tokens) {
      const raw = token.replace(/[^a-zA-Z0-9]/g, '');
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

/**
 * Deduplicated entity list with each entity's first token position.
 * Position -1 = not found in the token stream (ingested but excluded from
 * co-occurrence edges).
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
 * Co-occurrence pairs from entity positions. Two entities co-occur when their
 * first token positions are within `window` tokens. Weight = 1 / distance.
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
