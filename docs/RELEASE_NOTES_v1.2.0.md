# Wolfkrow v1.2.0 — Release Notes

> **Data:** 2026-06-26
> **Plano:** `docs/mvp_final_plan_v2.md` (EPIC 0–6, exceto débitos diferidos)
> **Validação:** `docs/MVP_VALIDATION_V2.md`

## Highlights

Six bugs bloqueantes resolvidos (chat FK, SDK routing, provider override/edit, MCP errors, worker isolation). Cadastros padronizados como tabela + tela de edição com markdown (Agents, Skills, Rules, MCP, Channel). Métricas com split cloud/local e per-phase cost. Run consoles full-screen para harness + pipeline. Sidecar Design Studio sai de placeholder para UI funcional.

## Breaking changes

Nenhuma quebra na API pública. Mudanças internas:

- `chat_sessions.agent_id` agora nullable com `ON DELETE SET NULL` (migration 0010_cool_magneto já existia — agora `agentId ?? ''` → `agentId ?? null` em todos os callers).
- `token_usage` ganha coluna `runtime` (`cloud|local`, default `cloud`) — migration `0011_token_usage_runtime.sql` + index `0012_token_usage_runtime_idx.sql`.
- `pipeline_projects` ganha coluna `project_path` — migration `0010_pipeline_project_path.sql`.
- `UsageSummary` schema: campo `byRuntime` obrigatório (default `{}`).
- `PhaseMetrics` domain: campo `cost` obrigatório (USD cents).
- `RoundMetrics` shared-types: campos `coderTokens` + `evaluatorTokens` (default 0, parse OK em payloads legados).

## EPIC 0 — Bug fixes

| # | Fix | Commit |
|---|---|---|
| 0.1 | Chat FK (`chat_sessions.agent_id` nullable) | `f386500` |
| 0.2 | SDK routing p/ claude-compat em chat sem agente | `b8f0a8f` |
| 0.3 | Provider `id` travado em edit (override não duplica) | `75da3cd` |
| 0.4 | Provider edit mostra `hasApiKey` + preserva chave | `f5e3ad8` |
| 0.5 | Fetch errors surfaced (Agents/Skills/MCP) | `a64beb6` |
| 0.6 | Worker user isolation removido (owner-rewrite) | `b87d3e1` |

## EPIC 1 — Cadastros (tabela + tela dedicada com markdown)

| # | Item | Commit |
|---|---|---|
| 1.1 | Agents edit screen + dynamic provider selector | `dfe1b57` |
| 1.1 (polish) | Agents New screen + nav icon Wrench parity | `fa3c1cc` |
| 1.2 | Skills edit screen | `60c3f54` |
| 1.3 | Rules edit screen | `60c3f54` |
| 1.4 | MCP edit screen | `32bc59d` |
| 1.5 | Provider polish (ConfirmDialog unificado) | `35e0a1f` |
| 1.6 | Channel config tabela | `89b00ed` |

## EPIC 2 — Harness / Pipeline / Projetos

| # | Item | Commit |
|---|---|---|
| 2.1 | Dedicated Run consoles (harness + pipeline) | `072187c`, `f2f5ffe` |
| 2.2 | Pipeline project path field (allowlist) | `b986724` |
| 2.3a | Cloud/local runtime split em `token_usage` | `c2d293b` |
| 2.3b | `PhaseMetrics.cost` + cálculo via pricing | `f14c381` |
| 2.3c | Shared `RoundMetrics` coder/evaluator split | `b52532e` |
| 2.3d | Dashboard runtime + source split | `43ab9cf` |

## EPIC 3 — Layout / Redesign

| # | Item | Commit |
|---|---|---|
| 3.1a | Drop dashboard double-title (Topbar breadcrumb handles root) | `bd67edf` |
| 3.1b | PageHeader uniforme em memory/scheduler/enrich | `8892888` |
| 3.2 | Settings hub slim (orphan routes only: Providers + Voice + Vault shortcut) | `3c4ba4c` |

## EPIC 4 — Open Design Studio

| # | Item | Commit |
|---|---|---|
| 4.1 | Sidecar UI funcional (substitui placeholder) | `d2fde82` |
| 4.1 | Sidecar open-design proxy route (worker daemon) | `33c5428` |

## EPIC 5 — Chat parity

Validado — 13/13 use-case tests + 4/4 chat-send tests verdes. Picker de provider/LLM já existia.

## EPIC 6 — Auditoria

- Gate analógico (test+typecheck+coverage) substituindo `qa-verdict.sh` (não instalado).
- `docs/MVP_VALIDATION_V2.md` (107 linhas) com checklist por EPIC.
- `docs/FEATURE_MATRIX.md` (seção v2) com status deltas.

## Migration order (fresh install)

```
0000..0009 (drizzle baseline)
0010_pipeline_project_path.sql
0011_token_usage_runtime.sql
0012_token_usage_runtime_idx.sql
```

## Known debts (não bloqueantes, tracked em `MVP_VALIDATION_V2.md`)

1. `packages/design-tools` package consolidation (LionClaw port multi-dia).
2. Infra coverage: `memory-tool.ts`, `skill-tool.ts`, `web-tool.ts` em 0% (3 tools sem testes).
3. 11 lint errors pré-existentes (`max-lines-per-function`, arbitrary `max-w-[Nch]`).
4. Smoke E2E Playwright (`apps/web/e2e/`) — specs prontos, não executados headless nesta sessão.
5. `wolfkrow-audit` (4 auditores security/performance/quality/scope) — não executado.
6. Sidecar/open-design routes unauthed — hardening futuro (privileged global op).

## Métricas

| | v1.1 | v1.2 |
|---|---|---|
| Commits mergeados (sessão v2) | — | 11 (EPIC 0.1–4.1) |
| Testes totais (soma dos pacotes) | ~1700 | ~1786 |
| Cobertura mínima backend | 85% | 85.27% (worker) ✅ |
| Cobertura frontend | 70% | 77.36% (web) ✅ |
| Lint erros pré-existentes | (baseline) | 11 (tracked) |

## Próxima versão (v1.3 candidatos)

- Fixar 3 infra tools (coverage gap).
- Rodar `wolfkrow-audit` (security + perf + quality + scope).
- Smoke E2E Playwright automatizado no CI.
- `packages/design-tools` (LionClaw parity profundo do Studio).