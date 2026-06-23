# ADR-0028: Voyage AI para Embeddings (supercede ADR-0016 §embeddings)

**Status**: ✅ Aceito
**Data**: 2026-06-23
**Supercede**: ADR-0016 (seção de embeddings — linha 92)

## Contexto

ADR-0016 escolheu `better-sqlite3 + sqlite-vec` para o database engine e referenciou "Anthropic embeddings" no schema de exemplo. O Wolfkrow precisava de um provider de embeddings para o Knowledge Base (RAG local) e Semantic Memories.

Opções avaliadas:
1. **Anthropic API** — não expõe endpoint de embeddings públicos para texto geral
2. **OpenAI `text-embedding-3-small`** — 1536 dims, vendor lock-in com OpenAI
3. **Voyage AI `voyage-3`** — 1024 dims, especializado em retrieval, melhor custo-benefício
4. **Ollama local** — zero custo, mas requer infra local e qualidade inferior
5. **Google `text-embedding-004`** — 768 dims, requer conta GCP

## Decisão

**Voyage AI `voyage-3`** via HTTP REST API, implementado em `VoyageEmbedder`.

```typescript
// packages/infra/src/embeddings/voyage-embedder.ts
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

export class VoyageEmbedder implements EmbeddingPort {
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'voyage-3',
  ) {}

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    // ...
  }
}
```

**Schema** — embeddings armazenados como `text` JSON (`number[]`):

```typescript
// packages/infra/src/db/schema/knowledge.ts
embedding: text('embedding', { mode: 'json' }).$type<number[]>(),
```

**Busca vetorial** — JS brute-force cosine similarity (O(n)), adequado para corpora locais até ~5 k chunks:

```typescript
// packages/infra/src/repos/knowledge-chunk-repo.ts — cosineSimilarity()
export function cosineSimilarity(a: number[], b: number[]): number { ... }
```

## Consequências

**Positivas**:
- `voyage-3` tem recall superior ao `text-embedding-3-small` em benchmarks de retrieval
- 1024 dims vs 1536 = menos storage, queries JS mais rápidas
- API simples (sem SDK proprietário)
- `EmbeddingPort` abstrai o provider — troca futura sem mudar domínio

**Negativas**:
- Requer `VOYAGE_API_KEY` no vault (custo por token)
- Busca JS O(n) não escala além de ~5 k chunks — roadmap: migrar para `sqlite-vec` `vec0` virtual table quando corpus crescer

## Roadmap de escala

Quando corpus > 5 k chunks, substituir busca JS por `vec_distance_cosine` em virtual table:

```sql
-- sqlite-vec vec0 virtual table (dimensão 1024)
CREATE VIRTUAL TABLE knowledge_vec USING vec0(
  embedding float[1024]
);
```

Reescrever `vectorSearch()` em `DrizzleKnowledgeChunkRepo` para usar `sql\`vec_distance_cosine(...)\`` com `LIMIT`. Sem mudança na camada de domínio.

## Referências

- `packages/infra/src/embeddings/voyage-embedder.ts` — implementação
- `packages/infra/src/repos/knowledge-chunk-repo.ts` — cosineSimilarity + vectorSearch + keywordSearch
- `packages/infra/src/db/schema/knowledge.ts` — schema
- ADR-0016 — database engine (better-sqlite3 + sqlite-vec para o resto)
