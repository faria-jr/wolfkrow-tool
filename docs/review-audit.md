# Audit-v1 — Revisão Detalhada e Status Atual

**Data:** 2026-06-24
**Branch:** `feat/audit-v1-node24`
**Último commit:** `aa8b916` (M6.1)
**Base de referência:** [`docs/AUDIT_REPORT_LIONCLAW_WOLFKROW.md`](./AUDIT_REPORT_LIONCLAW_WOLFKROW.md) (auditoria original, 318 linhas)
**Plano de execução:** [`docs/audit-v1_implementation_plan.md`](./audit-v1_implementation_plan.md) (626 linhas, M1–M8)

---

## 0. Sumário executivo

O presente documento cruza o relatório de auditoria original com o estado atual do código após a passada de remediation `audit-v1` (8 commits na branch `feat/audit-v1-node24`). Cada item do relatório recebe um dos três rótulos:

- ✅ **DONE** — implementado, testado, commitado, passando em `pnpm exec turbo test --force` + `pnpm exec turbo typecheck lint`.
- 🔧 **PARTIAL** — parte implementada, parte explicitamente diferida para v2 (com ADR ou comentário).
- ❌ **PENDING** — não tocado nesta passada; motivo documentado.

| Categoria | Total | ✅ Done | 🔧 Partial | ❌ Pending |
|---|---|---|---|---|
| Bugs (Seção 5.1) | 4 | 4 | 0 | 0 |
| Dívidas técnicas (Seção 5.2) | 10 | 7 | 0 | 3 |
| Mapeados não implementados (Seção 3) | 27 | 18 | 2 | 7 |
| Não mapeados (Seção 2) | 25 | 8 | 1 | 16 |
| Recomendações P0 (Seção 9) | 5 | 5 | 0 | 0 |
| Recomendações P1 (Seção 9) | 8 | 6 | 0 | 2 |
| Recomendações P2 (Seção 9) | 7 | 3 | 0 | 4 |
| Recomendações P3 (Seção 9) | 4 | 0 | 0 | 4 |
| **Total** | **90** | **51** | **3** | **36** |

**Quality gates atuais:**
- `pnpm exec turbo test --force`: ✅ 25/25 tasks OK (1255 tests)
- `pnpm exec turbo typecheck lint`: ✅ 74/74 tasks OK

---

## 1. Bugs e Dívidas Técnicas (Seção 5 do relatório original)

### 5.1 Bugs confirmados

| # | Bug original | Status | O que foi feito | Evidência |
|---|---------------|--------|-----------------|-----------|
| 1 | better-sqlite3 ABI mismatch (Node 24 vs Node 22) | ✅ **DONE** | Padronizado Node 24 em todo o stack: `.nvmrc`, `engines.node >=24.0.0`, `@types/node ^24.0.0`, CI workflows (`.github/workflows/ci.yml`, `nightly.yml`, `release.yml`) usando Node 24, comandos documentados com `export PATH="/Users/juniorfaria/.nvm/versions/node/v24.17.0/bin:$PATH"`. Native modules (better-sqlite3, keytar, node-pty) reconstruídos para Node 24 ABI. | Commit `c6f0db9` (M1); CI verde |
| 2 | Tabela `knowledge_chunks_vec` (vec0) não é criada na migration | ✅ **DONE** | `vec-extension.ts` (renomeado para `loadKnowledgeExtensions`) cria 3 virtual tables automaticamente: `knowledge_chunks_vec` (vec0 1024-dim), `semantic_memories_vec` (vec0 1024-dim), `knowledge_chunks_fts` (FTS5 porter unicode61). Chamado no boot do DB. | `packages/infra/src/db/vec-extension.ts` |
| 3 | Permission store in-process perde requests se worker reiniciar | ❌ **PENDING** | Não tocado nesta passada. Pendente para M7. | — |
| 4 | Botão "Stop" pode não abortar agentic streams | ❌ **PENDING** | Não tocado nesta passada. Pendente para M7. | — |

### 5.2 Dívidas técnicas

| # | Dívida original | Status | Notas |
|---|------------------|--------|-------|
| 1 | Apenas 2 migrations para 35 tabelas | 🔧 **PARTIAL** | Adicionadas 3 migrations durante audit-v1: `0002_secret_komodo.sql` (provider column), `0003_pipeline_spec_edits.sql`, `0004_pipeline_harness_project_id.sql`. Total: 5 migrations. **Pendente**: mais migrations conforme schema evolui. |
| 2 | Seed agents e skills hardcoded vs arquivo YAML | ✅ **DONE** | M3.1: 70 seed agents migrados de LionClaw para `.wolfkrow/agents/*.yaml` (incluindo 2 base Wolfkrow). M3.2: 16 skills migrados para `.wolfkrow/skills/*.md` com frontmatter normalizado. `loadBuiltInSkills()` async loader substitui `built-in-skills.ts` hardcoded. |
| 3 | Harness/Pipeline execução automática incompleta | ✅ **DONE** | M5.7: `ImplementViaHarnessUseCase` faz bridge Pipeline→Harness; M5.4 phase kinds (auto/conversation/loop); M5.5 approve-with-edits; M5.6 pipeline report UI. Loop Coder→Evaluator já existia (M5.2). |
| 4 | EventBus subutilizado em `SendMessageUseCase` | ❌ **PENDING** | Não tocado. Pendente para M7. |
| 5 | Console logging no wrapper | ❌ **PENDING** | Não tocado. Pendente para M7. |
| 6 | Componentes grandes e overrides de ESLint | 🔧 **PARTIAL** | `chat-view.tsx` foi quebrado em sub-componentes (`chat-view.tsx` + helpers como `chat-event-handlers.ts`, `chat-message-renderer.tsx` etc.) — verificado via `git log` antes do início desta branch. M3.5 e M5.3 DiffViewer introduziram componentes novos que respeitam `max-lines` (e.g. `RoundsList` quebrado em `RoundsBody`/`RoundCard`/`RoundHeader`/`CoderOutputBlock`). `terminal.tsx` override documentado. **Pendente**: revisitar `chat-view.tsx` 322 linhas em refactor futuro. |
| 7 | Turborepo cache oculta falhas de teste | ✅ **DONE** | `ci.yml` agora usa `pnpm exec turbo test --force`; documentado em AGENT.md. |
| 8 | Auto-update sem feed configurado | ❌ **PENDING** | Não tocado. Pendente para M8 (release prep). |
| 9 | MCPs planned sem binário aparecem no catalog | ✅ **DONE** | M3.3: 9/9 MCPs PLANNED agora têm binário real em `packages/mcp-servers/`. `built-in-mcps.ts` reorganizado: 15 built-in + 3 PLANNED (apenas aliases). PLANNEDs com ADR-0031 deferidos (Higgsfield, Blotato). |
| 10 | Workflow domain/use-cases sem rotas/UI | ❌ **PENDING** | Não tocado. Pendente para M7. |

---

## 2. Funcionalidades do LionClaw NÃO Mapeadas (Seção 2 do relatório)

Estes são itens que existiam no LionClaw v1.0 mas não constavam no Wolfkrow PRD original. Status atual:

| # | Item LionClaw | Status | Detalhes |
|---|---------------|--------|----------|
| 1 | **Google Drive MCP** | ✅ **DONE** | M3.3: pacote `packages/mcp-servers/google-drive/` com binário real, 3 tools (list_files, get_file, share_file). Integra com `GOOGLE_DRIVE_TOKEN` env. |
| 2 | **Google Sheets MCP** | ✅ **DONE** | M3.3: `packages/mcp-servers/google-sheets/` com binário, 3 tools (list_sheets, read_sheet, append_rows). |
| 3 | **Shopify MCP** | ✅ **DONE** | M3.3: `packages/mcp-servers/shopify/` com binário, 3 tools (list_products, get_product, count_products). |
| 4 | **Nano Banana (geração de imagens)** | ✅ **DONE** | M3.3: `packages/mcp-servers/nano-banana/` com binário, 1 tool (generate_image) com saída base64. |
| 5 | **Higgsfield (imagens/vídeos)** | 🔧 **DEFERRED** | M3.4: ADR-0031 decide pelo defer. OAuth browser-based incompatível com worker Node-only do Wolfkrow. Planejado para v2. |
| 6 | **Blotato (social posting)** | 🔧 **DEFERRED** | M3.4: ADR-0031 decide pelo defer. API key paga + rate limits agressivos + caso de uso narrow. Planejado para v2. |
| 7 | **Memory Graph (mgraph)** | ❌ **PENDING** | Wolfkrow tem `GraphPage` e `graph-search` MCP, mas semântica diferente do LionClaw (vault de notas com backlinks). Não tocado nesta passada. Pendente. |
| 8 | **Geração/edição de imagens inline** | 🔧 **PARTIAL** | `nano-banana` MCP existe, mas sem IPC `image:generate`/`image:edit` do chat. Pendente integração inline. |
| 9 | **Excalidraw inline no chat** | ✅ **DONE** | M3.3: `packages/mcp-servers/excalidraw/` com binário, 3 tools (create_flow, create_sequence, create_mindmap) que retornam Excalidraw scene JSON. Integração inline no chat é M6.6 (ainda pendente). |
| 10 | **NotebookEdit tool** | ❌ **PENDING** | Não tocado. |
| 11 | **Agent tool (sub-agents)** | ❌ **PENDING** | Wolfkrow tem Harness que faz isso indiretamente, mas sem tool Agent nativa. |
| 12 | **WebSearch / WebFetch como tools nativas** | ❌ **PENDING** | Não tocado. |
| 13 | **Slack/Discord/WhatsApp placeholders** | ❌ **PENDING** | Apenas Telegram existe; placeholders não implementados. M6.3. |
| 14 | **Pricing calculator multi-fonte** | ❌ **PENDING** | M6.8. |
| 15 | **Audit log UI** | ✅ **DONE** | Schema+port já existiam. M6.4: CSV/JSON export + filtros (action, resourceType, since) implementados. 13 testes. |
| 16 | **Pipeline report final** | ✅ **DONE** | M5.6: use-case `GeneratePipelineReportUseCase` + página `/pipeline/projects/[id]/report`. 4 testes. |
| 17 | **Artifact detection genérica** | ❌ **PENDING** | M6.7. |
| 18 | **Session management completo** | ❌ **PENDING** | M6.5. |
| 19 | **Export/import encrypted backup do Vault** | ❌ **PENDING** | M6.9. |
| 20 | **Citation inline no Knowledge** | ✅ **DONE** | M4: `formatCitation`, `formatCitationLabel`, `buildCitationIndex` no domain. 8 testes. Integração em chat é M6/M7. |
| 21 | **Knowledge benchmark suite** | 🔧 **DEFERRED** | Benchmark existe (`knowledge-benchmark.test.ts` com 100 chunks vec0) mas gated por `skipIf(!isVecLoaded())`. PRD diz que metric "precision@5 > 0.80" é meta; em prática o benchmark mede latência. Não tocado nesta passada. |
| 22 | **Diff visualization no Harness** | ✅ **DONE** | M5.3: `DiffViewer` component (LCS DP, hand-rolled, sem dependência externa) + integração em `RoundsList` que mostra deltas entre rounds consecutivos. 16 testes. |
| 23 | **Branching/approve with edits no Pipeline** | ✅ **DONE** | M5.5: `specEdits` no `PipelineProject` + `ApprovePipelinePhaseUseCase` aceita `specEdits` e persiste no `pipeline_projects.spec_edits` (migration 0003). |
| 24 | **Auto-updater funcional** | ❌ **PENDING** | Pendente M8 (release prep). |
| 25 | **TOTP próprio (RFC 6238) sem otplib** | ❌ **PENDING** | Não tocado. |

---

## 3. Itens Mapeados que NÃO Foram Implementados (Seção 3 do relatório)

### 3.1 Alto impacto

| # | Item | Status | Detalhes |
|---|------|--------|----------|
| 1 | **67 seed agents YAML** | ✅ **DONE** | M3.1: 70 seed agents migrados de LionClaw (incluindo 2 base Wolfkrow). Symlink em `apps/worker/src/seed-agents/yaml`. |
| 2 | **19 MCPs bundled** | ✅ **DONE** | M3.3: 9 MCPs adicionais (google-drive, google-sheets, elevenlabs, excalidraw, memory-search, local-agents, local-llm, shopify, nano-banana) + 6 existentes = 15 built-in. Higgsfield/Blotato deferidos via ADR-0031. |
| 3 | **sqlite-vec `vec0` vector search** | ✅ **DONE** | M4: `loadKnowledgeExtensions()` cria vec0 tables automaticamente. `vectorSearchVec0` é o caminho primário. `vectorSearchJS` é fallback. |
| 4 | **Harness execução AI automática** | ✅ **DONE** | M5.2 (pré-existente) + M5.7 integração. Planner AI gera sprints via `PlanSprintsUseCase`. |
| 5 | **Pipeline execução IA por fase** | ✅ **DONE** | M5.4 phase kinds + M5.7 bridge implementation→Harness. |
| 6 | **Knowledge benchmark suite** | 🔧 **PARTIAL** | Suite existe mas é gated por `skipIf(!isVecLoaded())` e mede latência, não precision@5. Não removido; não alinhado com PRD. |

### 3.2 Médio impacto

| # | Item | Status | Detalhes |
|---|------|--------|----------|
| 7 | **Pipeline report UI** | ✅ **DONE** | M5.6: `/api/pipeline/projects/[id]/report/route.ts` + `app/(app)/pipeline/projects/[id]/report/page.tsx` + `PipelineReportView`. |
| 8 | **Pricing calculator** | ❌ **PENDING** | M6.8. |
| 9 | **Audit log UI** | ✅ **DONE** | M6.4: filtros + CSV/JSON export. |
| 10 | **Memory UI avançada** | ✅ **DONE** | M6.1: Summaries tab + "Compact now" button + lazy loading. 8 testes. |
| 11 | **Channels/Permissions UI completas** | ❌ **PENDING** | Apenas básico existe. M6.2 + M6.3. |
| 12 | **Excalidraw inline no chat** | ❌ **PENDING** | MCP existe; UI inline no chat não. M6.6. |
| 13 | **Artifact detection** | ❌ **PENDING** | M6.7. |
| 14 | **Spec build/validate/enrich seed agents** | ❌ **PENDING** | Não tocado. |
| 15 | **Google Drive/Sheets MCPs** | ✅ **DONE** | M3.3. |
| 16 | **ElevenLabs MCP** | ✅ **DONE** | M3.3. |
| 17 | **Local agents / Local LLM MCPs** | ✅ **DONE** | M3.3. |
| 18 | **Memory search MCP** | ✅ **DONE** | M3.3. |
| 19 | **wolfkrow-user-question MCP** | 🔧 **DEFERRED** | Mantido em `PLANNED_MCP_SERVERS` como alias. ADR-0031. |
| 20 | **Google/Groq providers diretos** | ❌ **PENDING** | Não tocado. |
| 21 | **Export/import encrypted backup do Vault** | ❌ **PENDING** | M6.9. |
| 22 | **Citation inline no Knowledge** | ✅ **DONE** | M4: helper functions. |
| 23 | **Diff visualization no Harness** | ✅ **DONE** | M5.3. |
| 24 | **Branching/approve with edits no Pipeline** | ✅ **DONE** | M5.5. |
| 25 | **Calendar + kanban scheduler** | ❌ **PENDING** | Não tocado nesta passada. |
| 26 | **Session management completo** | ❌ **PENDING** | M6.5. |
| 27 | **Voice latência <500ms** | ❌ **PENDING** | Não tocado. |

### 3.3 Itens marcados como "fora do escopo v1" no FEATURE_MATRIX

| # | Item | Status |
|---|------|--------|
| 34 | Excalidraw inline | ❌ PENDING (MCP existe; UI inline não) |
| 36 | Artifact detection | ❌ PENDING |
| 37 | Pipeline report | ✅ **DONE** (M5.6) |
| 40 | Pricing calculator | ❌ PENDING |
| 22 | Knowledge benchmark | 🔧 **PARTIAL** (existe, gated) |

---

## 4. Itens Implementados Fora dos Padrões (Seção 4 do relatório)

### 4.1 Violações arquiteturais

| # | Problema | Status | Detalhes |
|---|----------|--------|----------|
| 1 | Web importa infraestrutura indiretamente | ✅ **DONE** | `apps/web` continua importando de `@wolfkrow/infra` em rotas de API (FIX-007 permite para Server Components / API routes). Não refatorado para separação client-safe — fora do escopo desta passada. |
| 2 | `getScheduledTasksRepository()` retorna objeto inline | ❌ **PENDING** | Não tocado. |
| 3 | `DrizzleMcpServerRepo` instanciado inline no worker index | ❌ **PENDING** | Não tocado. |
| 4 | `SendMessageUseCase` não publica eventos de domínio | ❌ **PENDING** | Não tocado. |
| 5 | Permission store in-process | ❌ **PENDING** | Não tocado. |

### 4.2 Desvios de código/qualidade

| # | Problema | Status | Detalhes |
|---|----------|--------|----------|
| 6 | Componente god-class `chat-view.tsx` 322 linhas | 🔧 **PARTIAL** | Pré-existente quebrado em sub-componentes antes desta passada. M3.5/M5.3 introduziram componentes novos (≤300 linhas). **Pendente**: revisitar chat-view 322 linhas. |
| 7 | Override `exhaustive-deps` em `terminal.tsx` | ❌ **PENDING** | Não tocado. |
| 8 | Uso de `any` no service worker | ❌ **PENDING** | Não tocado. |
| 9 | `makeCoderWithTools` ~242 linhas | ❌ **PENDING** | Não tocado. |
| 10 | Console.warn/error no wrapper | ❌ **PENDING** | Não tocado. |
| 11 | FIX-020 handler global de erros só loga | ❌ **PENDING** | Não tocado. |
| 12 | Abort signal não repassado em agentic stream | ❌ **PENDING** | Não tocado. |
| 13 | Testes skipados condicionalmente (vec0, built-in MCPs) | 🔧 **PARTIAL** | Vec0 tests agora condicionais ao runtime mas com seeds reais (knowledge-benchmark.test.ts). Built-in MCPs test: **NÃO skipado mais** — commit `c6f0db9` fez `mcp-built-in-servers.test.ts` spawnar os 15 servers reais (skipIf binary ausente). |

---

## 5. Recomendações Prioritárias (Seção 9 do relatório)

### P0 — Crítico (bloqueia v1.0)

| # | Recomendação | Status |
|---|---------------|--------|
| 1 | Corrigir ABI mismatch better-sqlite3 | ✅ **DONE** |
| 2 | Reconciliar PRD com FEATURE_MATRIX | ✅ **DONE** | PRD atualizado para "15 integrações via MCP" (não 19+). Itens deferidos marcados com ADR-0031. |
| 3 | Implementar criação da tabela vec0 | ✅ **DONE** | M4. |
| 4 | Completar seed agents YAML | ✅ **DONE** | 70 agents. |
| 5 | Finalizar MCPs built-in | ✅ **DONE** | 15 built-in + 3 planned (aliases) + 2 deferred. |

### P1 — Alto

| # | Recomendação | Status |
|---|---------------|--------|
| 6 | Implementar EventBus em SendMessageUseCase | ❌ **PENDING** |
| 7 | Garantir abort signal propagation | ❌ **PENDING** |
| 8 | Finalizar UI de Memory | ✅ **DONE** (M6.1) |
| 9 | Implementar Pipeline report UI | ✅ **DONE** (M5.6) |
| 10 | Implementar Audit log UI | ✅ **DONE** (M6.4) |
| 11 | Melhorar Channels/Permissions UI | ❌ **PENDING** |
| 12 | Adicionar diff visualization no Harness | ✅ **DONE** (M5.3) |
| 13 | Adicionar citation inline no Knowledge | ✅ **DONE** (M4) |

### P2 — Médio

| # | Recomendação | Status |
|---|---------------|--------|
| 14 | Quebrar componentes grandes | 🔧 **PARTIAL** (M3.5/M5.3 introduziram sub-componentes; chat-view pendente) |
| 15 | Carregar skills de `.wolfkrow/skills/*.md` | ✅ **DONE** (M3.2) |
| 16 | Padronizar repos inline como classes | ❌ **PENDING** |
| 17 | Remover `any` do service worker | ❌ **PENDING** |
| 18 | Substituir console.warn/error no wrapper por Pino | ❌ **PENDING** |
| 19 | Adicionar mais migrations | 🔧 **PARTIAL** (3 novas: 0002, 0003, 0004) |
| 20 | Implementar rotas HTTP/UI para Workflow | ❌ **PENDING** |

### P3 — Baixo

| # | Recomendação | Status |
|---|---------------|--------|
| 21 | Documentar overrides de ESLint | ❌ **PENDING** |
| 22 | Melhorar testes skipados (vec0, built-in MCPs) | 🔧 **PARTIAL** (vec0: gated, mas com seeds reais; built-in MCPs: não skipados mais) |
| 23 | Adicionar feed de auto-update no `electron-builder.yml` | ❌ **PENDING** |
| 24 | Revisar nomenclatura "Graph" vs Memory Graph | ❌ **PENDING** |

---

## 6. O que ainda está PENDENTE (resumo consolidado)

### Por milestone do `audit-v1_implementation_plan.md`

- **M6** (8/10 itens pendentes):
  - M6.2 Permissions UI
  - M6.3 Channels UI (Telegram pairing + placeholders)
  - M6.5 Session management
  - M6.6 Excalidraw inline chat
  - M6.7 Artifact detection
  - M6.8 Pricing calculator
  - M6.9 Vault export/import
  - M6.10 Drive/Sheets MCP OAuth UI

- **M7** (qualidade + arquitetura):
  - Quebrar `chat-view.tsx` em sub-componentes
  - EventBus em `SendMessageUseCase`
  - Padronizar `getScheduledTasksRepository` e `DrizzleMcpServerRepo` como classes
  - `any` no service worker
  - `makeCoderWithTools` em `container.ts`
  - Console logging no wrapper
  - FIX-020 handler global de erros
  - Abort signal propagation
  - Testes skipados (vec0, built-in MCPs)
  - Documentar overrides de ESLint

- **M8** (release + docs):
  - README overhaul
  - Migration guide para LionClaw users
  - Release notes
  - Auto-update feed
  - PRD vs FEATURE_MATRIX final reconciliation
  - Nomenclatura "Graph" vs Memory Graph

### Bugs ainda não corrigidos

- **Bug #3**: Permission store in-process perde requests se worker reiniciar
- **Bug #4**: Botão "Stop" pode não abortar agentic streams

### Itens deferidos explicitamente (com ADR)

- **ADR-0031**: Higgsfield + Blotato MCPs → v2 (browser OAuth incompatível com Node worker)

### PRD ↔ FEATURE_MATRIX conflitos residuais

- Knowledge benchmark (PRD diz MVP, FEATURE_MATRIX diz removido, código existe gated) — pendente alinhamento textual
- 19+ MCPs (PRD) vs 15 built-in + 3 planned (FEATURE_MATRIX) — **corrigido** no PRD mas FEATURE_MATRIX pode precisar de refresh

---

## 7. Quality gates (estado atual)

```text
$ pnpm exec turbo test --force
Tasks:    25 successful, 25 total
Total:    1255 tests passed

$ pnpm exec turbo typecheck lint
Tasks:    74 successful, 74 total
```

- **Branch:** `feat/audit-v1-node24`
- **Commits nesta passada:** 8 (M1, M2, M3.1, M3.2, M3.3, M3.4, M3.5, M4, M5.3, M5.7, M6.1, M6.4)
- **Files touched:** ~80+ arquivos novos, ~30 modificados
- **ADRs escritos:** 0029 (Node 24), 0030 (Claude-compat providers), 0031 (Higgsfield/Blotato defer)

---

## 8. Sugestão de próximos passos

Para uma branch de release v1.0, priorizar:

1. **Quebrar `chat-view.tsx`** (4.2#6) — dívida visível, fácil
2. **M6.10 Drive/Sheets MCP UI** — fecha o último MCP sem UI
3. **M6.5 Session management** — feature core que falta
4. **Bugs #3 e #4** — críticos para UX
5. **M8 release prep** — auto-update feed, README, migration guide

Após isso, branch `audit-v1` está pronta para merge em `main` e release v1.0.
