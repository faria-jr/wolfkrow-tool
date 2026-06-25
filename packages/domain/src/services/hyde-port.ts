/**
 * HyDE port (P3-6) — Hypothetical Document Embeddings. Generates a dense,
 * technical hypothetical answer to the query and embeds it for retrieval,
 * improving recall for queries with no keyword overlap. Feature-flagged;
 * `NoOpHyde` is the default.
 */
export interface HydePort {
  readonly enabled: boolean;
  generate(query: string): Promise<string | null>;
}
