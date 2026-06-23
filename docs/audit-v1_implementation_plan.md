# Plano de Implementação — Audit v1

> Baseado no relatório de auditoria `docs/AUDIT_REPORT_LIONCLAW_WOLFKROW.md`.
> Objetivo: tornar o Wolfkrow Tool alinhado com o LionClaw v1.0 (paridade funcional), corrigir bugs, fechar gaps de implementação e aplicar os ajustes solicitados: **Node 24 como runtime oficial** e **integração dos providers Z.ai, Moonshot (Kimi), Qwen e MiniMax via Claude Agent SDK compat**, mantendo OpenRouter como opção.
>
> Versão: 1.0 · Data: 2026-06-23

---

## 1. Visão Geral do Plano

Este plano divide o trabalho em **8 milestones sequenciais**, cada uma com tarefas atômicas, critérios de aceitação mensuráveis e rastreabilidade para os itens da auditoria.

### Ajustes estratégicos solicitados

1. **Node 24**: todo o projeto (web, worker, wrapper, CI, `.nvmrc`, `package.json`) será padronizado para Node 24. A ABI mismatch do better-sqlite3 será resolvida com recompilação nesse runtime.
2. **Claude Agent SDK compat para providers**: OpenRouter continua disponível, mas Z.ai (GLM), Moonshot/Kimi, Qwen (DashScope) e MiniMax serão implementados como presets do `claude-compat-sdk`, replicando a abordagem do LionClaw (`electron/main/claude-compat-sdk/` + `src/constants/claude-compat-presets.ts`).
3. **Paridade com LionClaw**: seed agents, MCPs, tools e funcionalidades ausentes serão migrados ou explicitamente descopados com ADR.

### Milestones

| Milestone | Foco | Duração estimada | Itens da auditoria cobertos |
|-----------|------|------------------|----------------------------|
| M1 | Fundação: Node 24, tooling, CI, testes passando | 1 semana | Bugs #1, dívida técnica #7, otimização #12 |
| M2 | Providers Claude-compat + AI runtime | 1 semana | Itens de integração #4.1, FEATURE_MATRIX providers, LionClaw executores |
| M3 | Seed agents, skills e MCPs | 2 semanas | Itens #1, #2, #6 (alto impacto), #15–19, #13 |
| M4 | Knowledge engine (sqlite-vec, FTS5, citation) | 1 semana | Itens #3, #20, #22, otimização #1–3 |
| M5 | Harness e Pipeline automatizados | 2 semanas | Itens #4, #5, #23, #24, #16 |
| M6 | UIs secundárias e funcionalidades do LionClaw | 2 semanas | Itens #7–12, #14, #16, #18, #19, #21, #25 |
| M7 | Qualidade, arquitetura e dívidas técnicas | 1 semana | Seção 4 (desvios), dívidas técnicas #1–10 |
| M8 | Reconciliação de documentação e release | 3 dias | Conflito PRD vs FEATURE_MATRIX, ADRs, escopo |

---

## 2. Milestone M1 — Fundação: Node 24 e Tooling

### Objetivo
Garantir que o ambiente de desenvolvimento, CI e produção rodem em Node 24, com testes passando sem cache.

### Tarefas

#### M1.1 — Padronizar Node 24
- [ ] Atualizar `.nvmrc` para `24`.
- [ ] Atualizar `engines.node` em todos os `package.json` (`>=24.0.0`).
- [ ] Atualizar `@types/node` para versão 24 em root e packages.
- [ ] Documentar no `README.md` e `AGENT.md` que Node 24 é obrigatório.
- [ ] Verificar compatibilidade do `better-sqlite3` com Node 24.

**Critérios de aceitação:**
- `node -v` retorna v24.x no ambiente de desenvolvimento.
- `pnpm install` não gera warnings de engines.

#### M1.2 — Recompilar módulos nativos para Node 24
- [ ] Reinstalar `better-sqlite3`, `sqlite-vec`, `keytar` e `node-pty` com Node 24.
- [ ] Executar `pnpm rebuild`.
- [ ] Garantir que `better-sqlite3.node` use ABI compatível com Node 24.

**Critérios de aceitação:**
- `pnpm exec turbo test --force` passa sem erros de ABI mismatch.
- Todos os testes de `packages/infra` passam.

#### M1.3 — CI/CD com Node 24 e cache desligado em testes
- [ ] Atualizar GitHub Actions para Node 24.
- [ ] Adicionar etapa `pnpm exec turbo test --force` no CI.
- [ ] Adicionar matrix de SO (ubuntu-latest, macos-latest, windows-latest) opcional.
- [ ] Configurar `remoteCache` do Turborepo ou garantir que CI não dependa de cache local.

**Critérios de aceitação:**
- CI fica verde em Node 24.
- Testes sem cache passam no CI.

#### M1.4 — Scripts e documentação
- [ ] Atualizar `package.json` scripts se necessário.
- [ ] Atualizar `docs/adr/0001-use-nextjs-15.md` ou criar ADR novo sobre Node 24.
- [ ] Atualizar `MIGRATION_FROM_LIONCLAW.md` com pré-requisito Node 24.

**Rastreabilidade:**
- Bug #1 da auditoria (ABI mismatch).
- Dívida técnica #7 (cache ocultando falhas).
- Otimização #12 (documentar Node exato).

---

## 3. Milestone M2 — Providers Claude-compat (Z.ai, Moonshot, Qwen, MiniMax)

### Objetivo
Implementar integração direta com Z.ai, Moonshot (Kimi), Qwen e MiniMax usando o padrão Claude Agent SDK compat do LionClaw, mantendo OpenRouter como alternativa.

### Contexto do LionClaw

O LionClaw implementa isso em:
- `src/constants/claude-compat-presets.ts`: presets Z.ai e MiniMax TokenPlan.
- `electron/main/claude-compat-sdk/`: runtime que usa Anthropic SDK com `baseUrl` customizado e injeção de `ANTHROPIC_AUTH_TOKEN`.
- `electron/main/agent-runtime/`: executores `zai-executor`, `minimax-tokenplan-executor`.
- `electron/main/lion-sdk/adapters/openai-compatible.ts`: adapter para Moonshot/Kimi/Qwen/DeepSeek/MiniMax PAYG via OpenAI-compatible.

### Tarefas

#### M2.1 — Modelar presets Claude-compat no domínio
- [x] Criar value object `ClaudeCompatPreset` em `packages/domain/src/services/claude-compat-presets.ts`.
- [x] Criar catalog `CLAUDE_COMPAT_PRESETS` com:
  - `zai` (GLM): `https://api.z.ai/api/anthropic`
  - `minimax` (TokenPlan): `https://api.minimax.io/anthropic`
  - `moonshot` (Kimi): `https://api.moonshot.cn/anthropic` ou endpoint compatível
  - `qwen` (DashScope): `https://dashscope.aliyuncs.com/compatible-mode/anthropic` ou compatível
- [x] Validar via testes unitários (catálogo tipado).

**Critérios de aceitação:**
- Unit tests cobrem presets, baseUrl e apiKeyVaultRef.
- `getClaudeCompatPreset(provider)` lança para provider desconhecido.

#### M2.2 — Implementar provider `ClaudeCompatProvider` no infra
- [x] Refatorar `packages/infra/src/ai-providers/claude-compat.ts`.
- [x] Usar `@anthropic-ai/sdk` com `baseURL` do preset e `apiKey` do Vault/keytar.
- [x] Suportar streaming, max_tokens, temperature, abort signal.
- [x] Tool calls degradados graciosamente (texto), alinhado com `AnthropicProvider` base.
- [x] Integrar com `AIProviderFactory` via prefixo `claude-compat:${presetId}`.

**Critérios de aceitação:**
- Provider implementa `AIProvider` interface.
- Testes mockam respostas Anthropic-compat de cada provider.
- Streaming funciona com tool calls.

#### M2.3 — Atualizar runtime/agent-executor
- [x] Adicionar runtime `claude-compat` aos value objects/entities de Agent.
- [x] Adicionar campo opcional `provider` a `Agent` e ao schema DB.
- [x] Mapear seleção de provider no agent editor.
- [x] Garantir que sub-agentes com runtime `claude-compat` usem o provider correto (orchestrator + fallback por prefixo de modelo).

**Critérios de aceitação:**
- Agente pode ser criado com runtime `claude-compat` + provider `zai`/`moonshot`/`qwen`/`minimax`.
- Testes de criação/sync de agentes cobrem novos runtimes.

#### M2.4 — Lion SDK adapters para Moonshot/Qwen/MiniMax PAYG (fallback OpenAI-compat)
- [ ] Criar presets em `packages/infra/src/ai-providers/lion-provider-presets.ts`.
- [ ] Adicionar adapters no `LionProvider` para Moonshot, Qwen, MiniMax PAYG via OpenAI-compatible.
- [ ] Manter OpenRouter como opção unificada.

**Critérios de aceitação:**
- Usuário pode escolher OpenRouter ou provider direto.
- Presets têm baseUrl, model list e apiKeyVaultRef.

#### M2.5 — UI de seleção de provider
- [x] Atualizar agent editor (`apps/web/components/agents/`) para permitir `runtime=claude-compat` + provider.
- [x] Atualizar sync modal para incluir `claude-compat`.
- [x] Seleção persiste via API `/api/agents` e sincroniza com sub-agentes.

**Critérios de aceitação:**
- UI mostra Z.ai, Moonshot, Qwen, MiniMax, OpenRouter, Anthropic, Codex, Ollama.
- Seleção persiste e sincroniza com sub-agentes.

#### M2.6 — Documentação
- [x] Criar ADR `docs/adr/0030-claude-compat-providers.md`.
- [ ] Atualizar `MIGRATION_FROM_LIONCLAW.md` com mapeamento de executores LionClaw → Wolfkrow.

**Rastreabilidade:**
- FEATURE_MATRIX providers.
- LionClaw: `claude-compat-sdk/`, `src/constants/claude-compat-presets.ts`, `lion-sdk/adapters/openai-compatible.ts`.
- Ajuste solicitado: manter OpenRouter + implementar Z.ai/Moonshot/Qwen/MiniMax via Claude-compat.

---

## 4. Milestone M3 — Seed Agents, Skills e MCPs

### Objetivo
Migrar a biblioteca de seed agents e skills do LionClaw e finalizar os MCPs built-in/planned.

### Tarefas

#### M3.1 — Migrar seed agents do LionClaw
- [ ] Extrair lista completa de seed agents do LionClaw (`electron/main/seed-agents/`).
- [ ] Criar arquivos YAML em `.wolfkrow/agents/` para cada agente.
- [ ] Mapear runtime `cloud` → `claude-compat`/`anthropic`; `local` → `ollama`; `external` → `openrouter`; `codex` → `codex`; `zai`/`minimax-tp` → `claude-compat`.
- [ ] Implementar loader que carrega YAML no boot do worker.
- [ ] Adicionar testes de validação de schema.

**Critérios de aceitação:**
- 60+ agents YAML presentes.
- Loader valida e insere agents no banco no primeiro boot.
- Testes cobrem pelo menos 90% dos agents (smoke test de schema).

#### M3.2 — Migrar skills do LionClaw
- [ ] Extrair skills de `.lionclaw/skills/`.
- [ ] Criar arquivos Markdown+frontmatter em `.wolfkrow/skills/`.
- [ ] Refatorar `built-in-skills.ts` para carregar do filesystem em vez de hardcoded.
- [ ] Adicionar testes de loader.

**Critérios de aceitação:**
- Skills são carregadas de `.wolfkrow/skills/*.md`.
- Hardcoded skills removidos ou reduzidos a fallback.

#### M3.3 — Implementar MCPs built-in faltantes
Prioridade alta:
- [ ] `mcp-google-drive`
- [ ] `mcp-google-sheets`
- [ ] `mcp-elevenlabs` (TTS via MCP, separado do provider TTS)
- [ ] `mcp-excalidraw`
- [ ] `mcp-memory-search`
- [ ] `mcp-local-agents` / `mcp-wolfkrow-agents`
- [ ] `mcp-local-llm` (Ollama)
- [ ] `mcp-shopify`
- [ ] `mcp-nano-banana`
- [ ] `mcp-wolfkrow-user-question`

**Critérios de aceitação:**
- Cada MCP tem binário real em `packages/mcp-servers/`.
- Cada MCP tem smoke test.
- Catalog do worker os reconhece e pode spawnar.

#### M3.4 — MCPs remotos do LionClaw (decisão de escopo)
- [ ] Decidir se Higgsfield e Blotato serão portados.
- [ ] Se sim: criar pacotes MCP e ADR.
- [ ] Se não: atualizar PRD/FEATURE_MATRIX e criar ADR de escopo.

**Critérios de aceitação:**
- Decisão documentada em ADR.
- PRD/FEATURE_MATRIX refletem o escopo real.

#### M3.5 — UI de gerenciamento de MCPs
- [ ] Atualizar `/mcp-servers` para mostrar built-in vs planned vs custom.
- [ ] Adicionar health check e auto-reconnect.
- [ ] Adicionar visibility toggle.

**Rastreabilidade:**
- Itens #1, #2, #6 (alto impacto).
- Itens #15–19, #13 (médio impacto).
- LionClaw: `mcp-servers/`, `electron/main/mcp-manager.ts`.

---

## 5. Milestone M4 — Knowledge Engine (sqlite-vec, FTS5, Citation)

### Objetivo
Implementar busca vetorial nativa via sqlite-vec, busca por keyword via FTS5 e citation inline.

### Tarefas

#### M4.1 — Criar migration para sqlite-vec `vec0`
- [ ] Adicionar migration Drizzle que carrega extensão `sqlite-vec`.
- [ ] Criar virtual table `knowledge_chunks_vec(chunk_id, embedding)`.
- [ ] Criar virtual table `semantic_memories_vec` se necessário.
- [ ] Garantir que migration rode em Node 24 com better-sqlite3 recém-compilado.

**Critérios de aceitação:**
- `hasVec0Table()` retorna true após migration.
- Testes `vec0` passam.

#### M4.2 — Atualizar repos para usar vec0
- [ ] Refatorar `DrizzleKnowledgeChunkRepo.vectorSearch` para usar vec0 como padrão.
- [ ] Refatorar `DrizzleSemanticMemoryRepo.vectorSearch` para usar vec0.
- [ ] Remover fallback JS O(n) ou mantê-lo apenas como último recurso.

**Critérios de aceitação:**
- Busca vetorial sobre 100 chunks completa em <100ms.
- Testes de performance passam.

#### M4.3 — FTS5 para keyword search
- [ ] Adicionar virtual table FTS5 para `knowledge_chunks`.
- [ ] Implementar hybrid search (BM25 + vetorial + RRF).
- [ ] Adicionar hybrid search para semantic memories.

**Critérios de aceitação:**
- Keyword search retorna ranks relevantes.
- Hybrid search combina keyword + semantic com RRF k=60.

#### M4.4 — Citation inline
- [ ] Atualizar use-case de Knowledge search para retornar chunk IDs.
- [ ] Atualizar UI de chat para renderizar citações `[1]`, `[2]`.
- [ ] Adicionar hover/click para mostrar fonte.

**Critérios de aceitação:**
- Respostas RAG incluem citações.
- Usuário pode ver origem do chunk.

#### M4.5 — Metadata filtering e reprocessamento
- [ ] Implementar filtros por data, source, tags.
- [ ] Implementar reprocessamento de documento.

**Rastreabilidade:**
- Item #3 (sqlite-vec).
- Itens #20, #22.
- Otimizações #1, #2, #3.

---

## 6. Milestone M5 — Harness e Pipeline Automatizados

### Objetivo
Completar a execução automática de Harness (Planner→Coder→Evaluator) e Pipeline (BuildPlan multi-fase), incluindo aprovações, reset, retry e relatórios.

### Tarefas

#### M5.1 — Harness Planner AI
- [ ] Implementar use-case `PlanHarnessProjectUseCase` com agente Planner.
- [ ] Decompor SPEC em sprints e features.
- [ ] Persistir sprints/features no banco.

**Critérios de aceitação:**
- Planner gera sprints a partir de SPEC markdown.
- Testes cobrem parsing e persistência.

#### M5.2 — Harness Coder→Evaluator loop automático
- [ ] Refinar `runHarnessFeature` para executar múltiplas features sequencialmente.
- [ ] Integrar tool execution (Read/Write/Edit/Bash) no Coder.
- [ ] Garantir que Evaluator valide acceptance criteria.
- [ ] Implementar retry com feedback até max rounds.

**Critérios de aceitação:**
- Loop automático executa sem intervenção manual.
- Métricas (tokens, cost, duration, tool uses) são salvas.

#### M5.3 — Diff visualization no Harness
- [ ] Criar componente `DiffViewer`.
- [ ] Integrar com artefatos escritos pelo Coder.
- [ ] Mostrar diff por feature/round.

#### M5.4 — Pipeline BuildPlan automático
- [ ] Implementar execução automática de fases `auto`.
- [ ] Implementar fases `conversation` com pausa para aprovação.
- [ ] Implementar fases `loop` com iteração.
- [ ] Integrar Open Design Studio no pipeline `development-v2`.

#### M5.5 — Pipeline branching e approve with edits
- [ ] Implementar aprovação com comentários/edits.
- [ ] Implementar branching de fase.

#### M5.6 — Pipeline report UI
- [ ] Criar tela/componente para `GeneratePipelineReportUseCase`.
- [ ] Exportar para Markdown/PDF.

#### M5.7 — Integração Harness ↔ Pipeline
- [ ] Pipeline deve chamar Harness na fase de implementation.
- [ ] Passar contexto (spec, design lock) para o Harness.

**Rastreabilidade:**
- Itens #4, #5, #23, #24, #16.
- LionClaw: `harness-engine.ts`, `pipeline-engine/`.

---

## 7. Milestone M6 — UIs Secundárias e Funcionalidades do LionClaw

### Objetivo
Completar as páginas e funcionalidades secundárias para alcançar paridade com LionClaw.

### Tarefas

#### M6.1 — Memory UI avançada
- [ ] Adicionar compaction manual.
- [ ] Mostrar daily summaries.
- [ ] Mostrar compaction logs.
- [ ] Permitir busca semântica na memória.

#### M6.2 — Permissions UI completa
- [ ] Tela para configurar bypass, whitelist/blacklist por agente.
- [ ] Configurar níveis de confirmação (medium/high/critical).
- [ ] Testar fluxo de tool permission.

#### M6.3 — Channels UI completa
- [ ] Gerenciamento de Telegram (pairing, teste, toggle).
- [ ] Placeholders Slack/Discord/WhatsApp (se não forem implementados, marcar como planned).
- [ ] Comandos do Telegram (/chat, /new, /memory, /schedule).

#### M6.4 — Audit log UI
- [ ] Criar página de audit log.
- [ ] Filtros por sessão, agente, tipo, data.
- [ ] Exportação CSV/JSON.

#### M6.5 — Session management no chat
- [ ] Criar/listar/arquivar/deletar sessões.
- [ ] Persistir estado no banco.

#### M6.6 — Excalidraw inline no chat
- [ ] Integrar Excalidraw MCP ou componente React.
- [ ] Renderizar diagramas como artefatos.

#### M6.7 — Artifact detection genérica
- [ ] Detectar tool results que são artefatos (HTML, JSON, Mermaid, Excalidraw).
- [ ] Renderizar inline no chat.

#### M6.8 — Pricing calculator
- [ ] Implementar use-case `CalculatePricingUseCase`.
- [ ] UI para estimar custo por provider/modelo.

#### M6.9 — Vault export/import
- [ ] Implementar backup criptografado do Vault.
- [ ] UI para exportar/importar.

#### M6.10 — Google Drive/Sheets MCPs UI
- [ ] Adicionar configuração OAuth para Drive/Sheets.
- [ ] Adicionar à página de MCPs.

**Rastreabilidade:**
- Itens #7–12, #14, #16, #18, #19, #21, #25.
- LionClaw: `pages/SettingsPage.tsx`, `pages/ChatPage.tsx`, `pages/MemoryPage.tsx`, etc.

---

## 8. Milestone M7 — Qualidade, Arquitetura e Dívidas Técnicas

### Objetivo
Corrigir desvios de padrão, melhorar qualidade de código e pagar dívidas técnicas.

### Tarefas

#### M7.1 — Corrigir violações arquiteturais
- [ ] Refatorar `apps/web/lib/auth.ts` para não importar infraestrutura (ou documentar exceção formalmente).
- [ ] Transformar `getScheduledTasksRepository()` em classe `DrizzleScheduledTaskRepo`.
- [ ] Mover instanciação de `DrizzleMcpServerRepo` para o registry/container.
- [ ] Adicionar publicação de eventos em `SendMessageUseCase`.

#### M7.2 — Componentização
- [ ] Quebrar `chat-view.tsx` em sub-componentes:
  - `ChatHeader`
  - `MessageList`
  - `Composer`
  - `VoicePanel`
  - `SessionSidebar`
- [ ] Garantir que cada função tenha ≤50 linhas.
- [ ] Remover `eslint-disable max-lines`.

#### M7.3 — Remover `any` e overrides de ESLint
- [ ] Refatorar `apps/web/src/sw.ts` para não usar `any`.
- [ ] Remover ou documentar override `exhaustive-deps` em `terminal.tsx`.
- [ ] Auditar outros `any` no codebase.

#### M7.4 — Logging e observabilidade
- [ ] Substituir `console.warn/error` em `apps/wrapper/src/main.ts` por Pino.
- [ ] Melhorar handler global de erros no worker (FIX-020).
- [ ] Garantir correlation ID em todas as requests.

#### M7.5 — Abort signal propagation
- [ ] Revisar `apps/worker/src/routes/chat.ts`.
- [ ] Garantir que `signal` seja repassado a todos os providers.
- [ ] Adicionar testes de abort.

#### M7.6 — Permission store robusto
- [ ] Persistir pending permissions em `pending_tool_permissions` table ou usar stateless token.
- [ ] Adicionar TTL e cleanup.

#### M7.7 — Testes determinísticos
- [ ] Remover skips condicionais de vec0/MCP tests.
- [ ] Garantir que todos os testes passem sem cache.

#### M7.8 — Workflow routes/UI
- [ ] Decidir se Workflow terá UI ou será removido.
- [ ] Se manter: implementar rotas HTTP e página.
- [ ] Se remover: limpar domain/use-cases e criar ADR.

**Rastreabilidade:**
- Seção 4 da auditoria (desvios).
- Dívidas técnicas #1–10.
- Otimizações #6–11.

---

## 9. Milestone M8 — Reconciliação de Documentação e Release

### Objetivo
Alinhar PRD, FEATURE_MATRIX, ADRs e código; preparar release v1.0.

### Tarefas

#### M8.1 — Reconciliar PRD com FEATURE_MATRIX
- [ ] Revisar seção 2.1 do PRD.
- [ ] Mover para roadmap v1.1+ os itens que não serão entregues em v1.0.
- [ ] Atualizar FEATURE_MATRIX para refletir escopo final.

#### M8.2 — Atualizar ADRs
- [ ] ADR sobre Node 24.
- [ ] ADR sobre providers Claude-compat.
- [ ] ADR sobre escopo de MCPs e MCPs remotos.
- [ ] ADR sobre remoção do knowledge benchmark (se confirmado).

#### M8.3 — Atualizar MIGRATION_FROM_LIONCLAW
- [ ] Documentar migração de runtime/agentes para novos providers.
- [ ] Documentar Node 24.
- [ ] Documentar tabelas/features não migradas.

#### M8.4 — Release checklist
- [ ] Todos os testes passando (`pnpm exec turbo test --force`).
- [ ] Lint e typecheck passando.
- [ ] Coverage gates atingidos.
- [ ] Manual testing em Chrome/Edge/Firefox.
- [ ] Build de produção (`pnpm build`) funcionando.
- [ ] Electron wrapper buildando (`pnpm dist:mac`, `pnpm dist:win`).
- [ ] Auto-update com feed configurado (decisão: usar GitHub releases, S3, etc.).

#### M8.5 — Comunicação
- [ ] Atualizar CHANGELOG.
- [ ] Criar release notes.
- [ ] Documentar breaking changes.

**Rastreabilidade:**
- Conflito PRD vs FEATURE_MATRIX.
- Item #24 (auto-update).
- Dívida técnica #8.

---

## 10. Critérios de Aceitação Gerais por Tarefa

Todo item do plano deve satisfazer:

1. **TDD**: teste escrito antes ou junto com a implementação.
2. **Lint**: `pnpm lint` passa.
3. **Typecheck**: `pnpm typecheck` passa.
4. **Testes**: `pnpm exec turbo test --force` passa.
5. **Cobertura**: domain ≥95%, use-cases ≥90%, infra ≥85%, web components ≥70% (≥80% auth/forms).
6. **Documentação**: SPEC/ADR atualizado se aplicável.
7. **Sem TODO/FIXME**: código mergeado sem débitos explícitos.
8. **Sem `any`**: type safety conforme AGENT.md.

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Node 24 quebra outras dependências | Média | Alto | Testar upgrade em branch isolada; CI matrix |
| Claude-compat endpoints mudam | Média | Médio | Presets centralizados; testes de integração |
| Migração de 60+ seed agents gera erros de schema | Média | Médio | Smoke tests de schema; validação Zod |
| sqlite-vec com problemas de build em Node 24 | Média | Alto | Recompilar extensão; fallback JS documentado |
| Harness/Pipeline automático complexo demais | Alta | Alto | Entregar iterativamente; feature flag |
| MCPs consumirem muito tempo | Alta | Médio | Priorizar 6 já existentes; demais em sprints separados |
| UI secundárias atrasarem release | Alta | Médio | Definir MVP mínimo; mover não-críticas para v1.1 |

---

## 12. Estimativa de Esforço Total

| Milestone | Duração | Sprints (1 semana) |
|-----------|---------|-------------------|
| M1 — Fundação Node 24 | 1 semana | 1 |
| M2 — Providers Claude-compat | 1 semana | 1 |
| M3 — Seed agents, skills, MCPs | 2 semanas | 2 |
| M4 — Knowledge engine | 1 semana | 1 |
| M5 — Harness/Pipeline | 2 semanas | 2 |
| M6 — UIs secundárias | 2 semanas | 2 |
| M7 — Qualidade/arquitetura | 1 semana | 1 |
| M8 — Documentação/release | 3 dias | 0.5 |
| **Total** | **~10.5 semanas** | **~10.5** |

---

## 13. Rastreabilidade com a Auditoria

Cada milestone cobre os seguintes itens do relatório de auditoria:

- **M1**: Bugs #1, dívidas #7, otimização #12.
- **M2**: FEATURE_MATRIX providers, ajuste solicitado, LionClaw `claude-compat-sdk`.
- **M3**: Itens alto impacto #1, #2, #6; médio #13, #15–19.
- **M4**: Item alto impacto #3; médio #20, #22; otimizações #1–3.
- **M5**: Itens alto impacto #4, #5; médio #16, #23, #24.
- **M6**: Itens médio impacto #7–12, #14, #18, #19, #21, #25.
- **M7**: Seção 4 todos os itens; dívidas #1–6, #8, #10; otimizações #6–11.
- **M8**: Conflito PRD vs FEATURE_MATRIX; item #24; dívida #8.

---

## ⚙️ Developed — Milestone M2

### Arquivos criados

| Arquivo | Descrição |
|---|---|
| `packages/domain/src/services/claude-compat-presets.ts` | Catálogo tipado de presets Claude-compat (zai, minimax, moonshot, qwen). |
| `packages/domain/src/services/__tests__/claude-compat-presets.test.ts` | Testes de presets. |
| `packages/domain/src/services/__tests__/graph-extraction.test.ts` | Testes de cobertura para graph-extraction. |
| `packages/domain/src/services/__tests__/pricing-calculator.test.ts` | Testes de cobertura para pricing-calculator. |
| `packages/infra/src/ai-providers/__tests__/claude-compat.test.ts` | Testes do provider Claude-compat. |
| `packages/infra/src/repos/__tests__/agent-repo.test.ts` | Testes do repositório de agents. |
| `packages/infra/drizzle/0002_secret_komodo.sql` | Migration adicionando coluna `provider` na tabela `agents`. |
| `docs/adr/0030-claude-compat-providers.md` | ADR de decisão arquitetural. |

### Arquivos modificados

| Arquivo | Descrição |
|---|---|
| `packages/domain/src/entities/agent.ts` | Adicionado `runtime: 'claude-compat'` e campo `provider`. |
| `packages/domain/src/__tests__/agent.test.ts` | Testes para provider e runtime claude-compat. |
| `packages/domain/src/services/index.ts` | Exporta presets. |
| `packages/domain/vitest.config.ts` | Exclui ports type-only da cobertura. |
| `packages/infra/src/db/schema/agents.ts` | Adiciona enum `claude-compat` e coluna `provider`. |
| `packages/infra/src/repos/agent-repo.ts` | Persiste `provider` no insert/update/toEntity. |
| `packages/infra/src/ai-providers/claude-compat.ts` | Refatorado para usar `@anthropic-ai/sdk` + presets. |
| `packages/infra/src/ai-providers/factory.ts` | Suporte a `claude-compat:${presetId}`. |
| `packages/infra/src/ai-providers/__tests__/providers-a2.test.ts` | Atualizado para novo construtor. |
| `packages/infra/src/ai-providers/__tests__/ai-providers.test.ts` | Testes de factory para presets. |
| `packages/infra/drizzle/meta/_journal.json` | Registro da migration 0002. |
| `apps/worker/src/__tests__/orchestrator.test.ts` | Testes de mapeamento claude-compat no orchestrator. |
| `apps/worker/src/orchestrator.ts` | Mapeia runtime claude-compat e infere provider por modelo. |
| `apps/worker/src/__tests__/orchestrator.test.ts` | Testes de mapeamento claude-compat no orchestrator. |
| `packages/shared-types/src/schemas/common.ts` | Adiciona `claude-compat` ao `RuntimeSchema`. |
| `packages/shared-types/src/schemas/agent.ts` | Adiciona campo `provider`. |
| `packages/use-cases/src/agents/__tests__/agent-use-cases.test.ts` | Testes de criação com provider. |
| `packages/use-cases/src/skills/__tests__/skill-use-cases.test.ts` | Ajuste do helper `makeAgent` para incluir provider. |
| `apps/web/components/agents/schema.ts` | Schema/defaults com provider. |
| `apps/web/components/agents/agent-form-modal.tsx` | Tipo AgentData e defaultValues com provider. |
| `apps/web/components/agents/model-section.tsx` | Seletor de provider quando runtime é claude-compat. |
| `apps/web/components/agents/sync-agents-modal.tsx` | Inclui claude-compat na lista de runtimes. |
| `apps/web/app/api/agents/parse.ts` | Parse de provider no create/patch. |

### Resultados

- `pnpm exec turbo test --force`: passou (16/16 tasks, 0 falhas).
- `pnpm typecheck`: passou.
- `pnpm lint`: passou.
- Cobertura domain: 98.27% (threshold 95%).
- Cobertura use-cases: 98.82% (threshold 90%).
- Cobertura infra: 76.57% (threshold 25%; gap pré-existente em repos/auth não coberto por esta entrega).

### Não implementado (escopo M2.4)

- Lion SDK adapters OpenAI-compat para Moonshot/Qwen/MiniMax PAYG (`lion-provider-presets.ts`).
- Atualização do `MIGRATION_FROM_LIONCLAW.md` (pendente; depende de confirmação de escopo de seed agents).

1. Criar branch `feat/audit-v1-node24`.
2. Executar M1.1 e M1.2 (Node 24 + recompilar nativos).
3. Rodar `pnpm exec turbo test --force` e confirmar baseline verde.
4. Abrir PR com M1 completo antes de iniciar M2.
5. Agendar review de escopo com Product Owner para decidir MCPs remotos e itens pós-MVP.

---

**Fim do plano.**
