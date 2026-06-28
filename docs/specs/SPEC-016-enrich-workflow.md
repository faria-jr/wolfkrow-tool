# SPEC-016: Enrich Pipeline + Workflow

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Worker + Web
**Prioridade**: P2
**Origem LionClaw**: `electron/main/` (enrich agents seed), schema `enrich_sessions`/`enrich_messages`, `workflow_runs`
**Fase do plano**: B.3

---

## 1. Visão Geral

Duas features que estavam **órfãs** (schema sem feature/SPEC no plano v1):

1. **Enrich**: loop Validator→Enricher sobre um SPEC. Valida estrutura/completude, enriquece com detalhes, devolve SPEC'.
2. **Workflow**: execução de workflows multi-step (`workflow_runs`). **Decisão obrigatória neste SPEC**: feature viva ou schema morto.

### User Stories

- US-1 (Enrich): refinar um SPEC bruto em SPEC executável.
- US-2 (Workflow): orquestrar sequência de agents/etapas reutilizável.

---

## 2. Decisão Workflow (P0 deste SPEC)

| Opção     | Critério                                      | Ação                                                                        |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| **Vivo**  | LionClaw usa `workflow_runs` em runtime ativo | Domain `WorkflowRun` + use-cases `StartWorkflow`/`AdvanceStep` + UI mínima  |
| **Morto** | Schema legado sem uso real                    | Remover `schema/workflow.ts` + `schemas/workflow.ts`; registrar em ADR-0027 |

> Auditar `lionclawv1.0` por referências a `workflow_runs` antes de implementar. Default: tratar como **vivo** com UI mínima até prova de morto.

---

## 3. Domain (Enrich)

```typescript
// packages/domain/src/entities/enrich-session.ts
export class EnrichSession {
  validate(spec: SpecDoc): ValidationReport {
    /* completude, AC mensuráveis */
  }
  enrich(spec: SpecDoc, report: ValidationReport): SpecDoc {
    /* preenche lacunas */
  }
}
```

---

## 4. Use-cases

```
StartEnrich · ValidateSpec · EnrichSpec   (loop até report.ok)
StartWorkflow · AdvanceWorkflowStep        (se vivo)
```

---

## 5. UI

- Enrich: modal via **parallel route** `@modal` sobre pipeline/harness; mostra diff SPEC→SPEC' em tempo real (otimização O20).
- Workflow: `workflow/` lista runs + step status (se vivo).

---

## 6. Testes

- `EnrichSession.validate/enrich` ≥95%.
- Loop converge (report.ok) sem laço infinito (guard de iterações).
- Workflow: transição de steps válida.

---

## 7. Gap fechado

Resolve schema órfão `workflow` e a feature enrich sem AC do plano v1.
