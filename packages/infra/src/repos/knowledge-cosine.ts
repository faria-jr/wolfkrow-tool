/**
 * Cosine similarity between two equal-length vectors. Returns 0 for a zero
 * vector (avoids divide-by-zero). Range: [-1, 1], higher = more similar.
 * Shared by `DrizzleKnowledgeChunkRepo` (JS fallback path) and
 * `DrizzleSemanticMemoryRepo`.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
