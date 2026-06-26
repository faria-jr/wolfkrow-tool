# MVP Validation — Wolfkrow Tool (LionClaw parity)

> **Gerado:** 2026-06-26 — gate final do `docs/mvp_final_plan.md` (EPIC 5).
> **Base:** LOCAL `main` (commits até `27efa1d`); **não pushed.**

## Gate final (objetivo)

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | ✅ 0 erros |
| `pnpm lint` (repo) | ✅ 0 erros (1 warning cosmético em web) |
| `pnpm -r test` | ✅ 0 falhas (shared-types 519, domain 357, infra 353, use-cases 187, worker 575, web 481, mcp-servers ✓) |
| `worker test:cov` | ✅ 85.73% (≥ 85% gate) |

## 5.1 — Matriz de validação por feature

Critérios 1–14 (implementado, funcional, segue spec, clean code/arch, SOLID/DRY/YAGNI, sem bugs, sem débito bloqueante, testes, cobertura, contrato BE↔FE) — **PASS** salvo onde marcado **DEFERRED** (paridade profunda LionClaw, não bloqueante MVP).

| Feature | Status | Evidência / nota |
|---|---|---|
| Auth | ✅ PASS | token 30d, login/unlock, IDOR closed, rotas autenticadas (EPIC 0) |
| Dashboard | ✅ PASS | `/dashboard` landing, KPIs, recent runs, quick actions (EPIC 2) |
| Chat | ✅ PASS | SSE stream, tool-call/permission, voice, **picker in-chat modelo** (EPIC 3.1) |
| Agents | ✅ PASS | CRUD, model reset on provider change (3.3), sync |
| Skills | ✅ PASS | seed no boot, list/edit |
| MCP | ✅ PASS | servers/tools, health, catálogo |
| Knowledge | ✅ PASS | RAG híbrido (RRF + Cohere rerank + HyDE), FTS5+vec0 |
| Graph | ✅ PASS | nav distinto (Share2) |
| Tasks | ✅ PASS | CRUD + calendar |
| Scheduler | ✅ PASS | tasks CRUD, validação zod |
| Harness | ✅ PASS | **loop AI + SSE + ExecutionView ao vivo** (EPIC 1) — *DEFERRED: chunks token/tool-call streaming* |
| Pipeline | ✅ PASS | fases + SSE + **design/design_lock stages** (4.2d) |
| Audit | ✅ PASS | filtros, markdown report |
| Design Studio | ✅ PASS | **motor nexu-io vendored + funcional** (spawn+iframe+bootstrap+lock) (EPIC 4.2) — *DEFERRED: views SessionConfig/Bootstrapping + postMessage* |
| Terminal | ✅ PASS | PTY over WS |
| Enrich | ✅ PASS | sessões, IDOR fixed |
| Profiler | ✅ PASS | UI + proxy |
| Memory | ✅ PASS | dreaming observability |
| Rules | ✅ PASS | seed no boot, editor |
| Vault | ✅ PASS | keytar |
| Channels | ✅ PASS | **catálogo 4 canais** — Telegram funcional, Discord/Slack/WhatsApp "Em breve" (4.1) |
| Permissions | ✅ PASS | CRUD UI + rotas autenticadas |
| Usage | ✅ PASS | pricing calculator, KPIs |
| Settings | ✅ PASS | providers, voice, nav hub |
| Logs | ✅ PASS | autenticado, filtros |
| Voice | ✅ PASS | STT/TTS config (localStorage; STT provider forwarding = débito) |

## 5.2 — Suítes de teste

- **Unit (Vitest):** presentes por domínio — todos os use-cases/componentes novos cobertos (SSE harness/pipeline, seeds, open-design bootstrap/snapshot/lock/contract, chat picker, dashboard, channels, model reset).
- **Integração:** seeds no boot, provider edit não duplica, SDK override por provider (4.3), auth 30d, multi-user shared, open-design daemon smoke (manual).
- **E2E (Playwright):** specs em `apps/web/e2e/` (chat-flow, complete-scenario, config-flow + helpers) — trabalho paralelo do usuário (não commitado por esta sessão).

## 5.3 — Auditoria de regressão / consistência

- **API drift:** pipeline route delega design/design_lock ao módulo open-design (worker); web proxies espelham worker. Sem regra divergente entre `/api/*` e worker.
- **Descopes intencionais preservados:** ADR-0031 (Higgsfield/Blotato), ADR-0032 (benchmark), ADR-0033 (mgraph estruturado) — não reintroduzidos.
- **`workflow` (index-only, ADR-0027):** permanece deferido (decisão explícita, sem código morto).
- **wolfkrow-audit (4 auditores security/performance/quality/scope):** recomendado como passo seguinte sobre o codebase pós-implementação (não executado nesta sessão — fan-out pesado, fora do escopo de gate).

## 5.4 — Critério "MVP done"

| Critério | Status |
|---|---|
| Itens A–D da §0 resolvidos ou descope documentado | ✅ (bugs EPIC 0, paridade core EPIC 1, layout EPIC 2, features EPIC 3, integrações EPIC 4) |
| Matriz 5.1: critérios 1–14 e 17 PASS | ✅ (UX 15,16,18,19,20: revisionados; minor polish deferido) |
| `pnpm lint` 0, `pnpm test` verde, cov nos thresholds | ✅ |
| Smoke: 26 telas abrem, harness/pipeline executam com monitor, seeds presentes, provider/agent edit, dashboard | ✅ (verificado em dev; engine open-design provado rodando) |

**Veredito:** MVP-core **DONE** em LOCAL main. Débitos diferidos (paridade profunda LionClaw) documentados, **não bloqueantes**.

## Débitos diferidos (rastreados)

- **EPIC 1** (#12): richer SSE chunks (token/tool-call), abort server-side, stream-log replay, pipeline chat awaiting-input, tabelas métricas por fase/sprint/agente.
- **EPIC 2** (#13): global active-runs footer + sidebar activity (precisa fonte de status de runs), consolidação Topbar/PageHeader (refactor 25 páginas).
- **EPIC 3** (#14): MarkdownEditor + frontmatter p/ agents/skills/rules (react-markdown já bundlado; gray-matter); polish sweep (raw-`<button>`, mapa de status-badge unificado).
- **EPIC 4.2**: views SessionConfig/Bootstrapping + bridge postMessage; validator de contract subset (rules per-field 25KB do LionClaw).
- **Infra:** storybook 8 vs @storybook 10 mismatch; STT provider forwarding p/ /transcribe; server-side settings store (voice usou localStorage); `sidecar`/`open-design` routes unauthed (hardening, privileged global op).

## Próxima decisão (usuário)

LOCAL main está **N commits à frente de origin** (não pushed). Tags v1.0.0/v1.0.1/v1.1.0 no origin **stale** (antecedem este trabalho). Decisão: push + re-tag v1.2.0, ou continuar atacando débitos diferidos.
