# ADR-0027: Workflow — Feature Viva ou Schema Morto

**Status**: ✅ Aceito — VIVO (2026-06-22)
**Data**: 2026-06-20 | **Atualizado**: 2026-06-22

## Contexto

O schema `workflow_runs` existe em `packages/infra/src/db/schema/workflow.ts` e há `packages/shared-types/src/schemas/workflow.ts`. O ADR original aguardava auditoria do `lionclawv1.0` (não disponível no repositório) antes de decidir.

Auditoria interna (2026-06-22) revelou que o **vertical-slice está implementado**:
- `packages/domain/src/entities/workflow-run.ts` — entidade com ciclo de vida completo
- `packages/domain/src/repos/workflow-repos.ts` — port `WorkflowRunRepo`
- `packages/infra/src/repos/workflow-run-repo.ts` — `DrizzleWorkflowRunRepo implements WorkflowRunRepo`
- `packages/use-cases/src/workflow/index.ts` — 4 use-cases (Create/Get/List/Execute)
- Registrado em `packages/infra/src/repos/registry.ts` (`getRepos().workflowRun`)

Ausente: rotas HTTP, UI — pendente como feature futura.

Decisão: implementar como feature de primeira classe ou remover.

## Decisão

**VIVO** — vertical-slice completo já existe; UI e rotas HTTP são trabalho futuro (deferred).

Dado que o domínio, infra e use-cases estão implementados, remover seria desperdício. Remoção exigiria dropar tabela + migration, com risco de perda de paridade com LionClaw. O custo de manter é zero (0 deps externas, 0 callers de produção ainda).

Próximo passo: rota `GET/POST /workflow-runs` + página `/workflow` quando SPEC-016 for priorizada.

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
