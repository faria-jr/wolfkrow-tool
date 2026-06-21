# ADR-0027: Workflow — Feature Viva ou Schema Morto

**Status**: 🔄 Proposto (decisão pendente de auditoria no LionClaw)
**Data**: 2026-06-20

## Contexto

O schema `workflow_runs` existe em `packages/infra/src/db/schema/workflow.ts` e há `packages/shared-types/src/schemas/workflow.ts`, **mas não há feature, SPEC, use-case nem UI** correspondente. Veio do LionClaw como possível resíduo. Plano v1 não rastreava — schema órfão.

Precisamos decidir: implementar como feature de primeira classe ou remover (evitar schema morto que viola DRY/clean code).

## Decisão (condicional)

Auditar `lionclawv1.0` por uso real de `workflow_runs` em runtime:

```bash
grep -rn "workflow_runs\|WorkflowRun\|workflow" lionclawv1.0/electron/main lionclawv1.0/src
```

| Resultado da auditoria | Decisão | Ação |
|---|---|---|
| Há leitura/escrita ativa de `workflow_runs` em fluxo real | **VIVO** | Implementar via SPEC-016 (domain `WorkflowRun` + use-cases `StartWorkflow`/`AdvanceStep` + UI mínima `workflow/`) |
| Só definição de schema, sem uso | **MORTO** | Remover `schema/workflow.ts` + `schemas/workflow.ts` + export no index; atualizar FEATURE_MATRIX |

**Default até a auditoria**: tratar como **VIVO** com UI mínima — remoção é irreversível em relação à paridade, então só remover com prova de não-uso.

## Consequências

### Se VIVO
- +1 feature rastreada, paridade preservada.
- Custo: domain + use-cases + UI mínima (~3 dias, dentro de B.3).

### Se MORTO
- −2 arquivos de schema, menos superfície morta.
- Migration Drizzle precisa dropar a tabela (se já criada) — incluir no migrador (D.1).

## Referências

- SPEC-016 (Enrich + Workflow)
- Regra clean-code: sem dead code / schema morto
- FEATURE_MATRIX.md (item Workflow)
