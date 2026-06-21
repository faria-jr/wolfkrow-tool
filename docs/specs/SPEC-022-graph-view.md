# SPEC-022: Graph View (Knowledge Graph)

**Status**: 📝 Draft
**Camada**: Worker (ingest) + Web (D3)
**Prioridade**: P2
**Origem LionClaw**: `electron/main/graph-ingest.ts` (1613), `mgraph-engine.ts` (1130), `src/pages/GraphPage.tsx`, `src/components/graph-view/`
**Fase do plano**: S.5

> ⚠️ **Gap**: no plano v1 a Graph virou só o componente `GraphCanvas` sob knowledge. Aqui volta a ser **página dedicada** (paridade as-is).

---

## 1. Visão Geral

Knowledge graph: ingest de entidades/relações a partir de documentos e memória; visualização navegável. **Melhoria O8**: substituir `mgraph-engine` (render estático) por D3 force layout interativo.

### User Stories

- US-1: Ver conexões entre documentos/conceitos.
- US-2: Navegar o grafo (zoom, drag, expand nó).
- US-3: Clicar nó → ver fonte (documento/memória).

---

## 2. Worker

```typescript
// apps/worker/src/knowledge/graph-ingest.ts  (LionClaw 1613 → módulos ≤300)
export class GraphIngest {
  ingest(doc: Document): { nodes: GraphNode[]; edges: GraphEdge[] } { /* extrai entidades+relações */ }
}
```

`mgraph.ts`: persistência do grafo (nodes/edges) + query de vizinhança. Refatorado de 1130 linhas → repo + service ≤300 cada.

---

## 3. Use-cases

```
IngestGraph · QueryNeighborhood · ExpandNode
```

---

## 4. UI

```tsx
// apps/web/components/graph/GraphCanvas.tsx — D3 force layout
'use client';
export function GraphCanvas({ nodes, edges }: GraphProps) {
  // d3-force simulation; drag, zoom; lazy-load D3 (dynamic import)
}
```

- `graph/page.tsx` (página dedicada) + `GraphCanvas` + side panel (`IngestHistoryList`, `NoteListView` refatorados em DataTable).
- **Otimização**: D3 carregado via `next/dynamic` (não no bundle inicial).

---

## 5. Testes

- `GraphIngest.ingest` (entidades/relações de doc fixture) ≥85%.
- `QueryNeighborhood`/`ExpandNode`.
- Component: render com grafo mock; interação drag/zoom (smoke).

---

## 6. Gap fechado

Página Graph dedicada recuperada (FEATURE_MATRIX #28→Graph). god-files 1613+1130 quebrados em módulos ≤300.
