# SPEC-015: Memory Pipeline + Dreaming

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Worker + Web
**Prioridade**: P1
**Origem LionClaw**: `electron/main/memory-pipeline.ts` (1407), `dreaming-gate.ts`, `dreaming-turn-engine.ts`, `embedding-provider.ts`
**Fase do plano**: N.5

---

## 1. Visão Geral

1. **Memory pipeline**: compaction automática quando context > threshold; daily summaries; semantic memories (embeddings) para retrieval cross-session.
2. **Dreaming**: manutenção em background quando idle (consolidação de memória, atualização de índice), 2 camadas — idle gate + turn engine. Pausa quando user volta.

### User Stories

- US-1: Assistant "lembra" conversas passadas sem repetir contexto.
- US-2: Daily summaries do que foi discutido.
- US-3: Manutenção automática sem bloquear UI.

---

## 2. Domain

```typescript
// packages/domain/src/services/compaction-policy.ts
export class CompactionPolicy {
  shouldCompact(usedTokens: number, maxTokens: number, ratio = 0.8): boolean {
    return usedTokens >= maxTokens * ratio;
  }
}
```

Entities: `SemanticMemory` (embedding + source), `DailySummary`, `CompactionLog`.
Ports: `MemoryRepo`, `EmbeddingProvider` (port no domain, adapter no infra).

---

## 3. Use-cases

```
CompactSession (resume turns antigos, persiste log) · ConsolidateMemory · GenerateDailySummary · SearchMemory
```

`CompactSession`: dispara em `shouldCompact`; gera resumo via provider; substitui turns por memory; grava `compaction_log`. Configurável (token count OU % do contexto).

---

## 4. Dreaming (Worker)

```typescript
// apps/worker/src/dreaming/gate.ts
export class DreamingGate {
  constructor(private idleMs = 5 * 60_000) {}
  onActivity() { this.lastActivity = Date.now(); }
  isIdle(now = Date.now()) { return now - this.lastActivity >= this.idleMs; }
}
```

`turn-engine`: loop de consolidação (1 tarefa por turn), checa `isIdle` entre turns, **pausa imediatamente no retorno do user**.

---

## 5. UI

- `memory/page.tsx`: lista semantic memories + daily summaries, trigger manual de compaction, logs (audit trail).

---

## 6. Testes

- `CompactionPolicy` (threshold edge) ≥95%.
- `CompactSession` (dispara/não dispara, idempotência) ≥90%.
- `DreamingGate.isIdle`, pausa no retorno.
- Integration: embedding + search.

---

## 7. Riscos

- Compaction perder contexto crítico → manter últimos N turns sempre; log reversível.
