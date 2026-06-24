# Relatório de Auditoria — Wolfkrow Tool vs LionClaw v1.0

**Data:** 2026-06-23  
**Auditor:** opencode (Claude Code)  
**Repositórios analisados:**
- `/Users/juniorfaria/projects/lionclawv1.0` (baseline funcional)
- `/Users/juniorfaria/projects/wolfkrow-tool` (projeto de destino)
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/specs/*`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/adr/*`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/ARCHITECTURE.md`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/FEATURE_MATRIX.md`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/IMPLEMENTATION_PLAN.md`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/MIGRATION_FROM_LIONCLAW.md`
- `/Users/juniorfaria/projects/wolfkrow-tool/docs/PRD.md`

**Metodologia:**
- Mapeamento automatizado das funcionalidades do LionClaw v1.0 (Electron desktop, SQLite local, ~78 migrations, ~60 seed agents, 18 MCPs built-in).
- Mapeamento da documentação e código-fonte do Wolfkrow-tool.
- Verificações de qualidade: `pnpm lint`, `pnpm typecheck`, `pnpm exec turbo test --force`.
- Análise cruzada de funcionalidades, padrões arquiteturais, dívidas técnicas e bugs.

---

## 1. Resumo Executivo

O Wolfkrow-tool é uma refatoração ambiciosa do LionClaw para uma arquitetura moderna baseada em Next.js 15 + Worker Node.js + SQLite local, aplicando Clean Architecture, TDD e monorepo pnpm/Turborepo. A implementação está **avançada e funcional em lint/typecheck**, com domínio/infra/use-cases cobrindo 35 tabelas e dezenas de casos de uso.

No entanto, a auditoria revela **divergências significativas entre o escopo documentado e o código entregue**:

- Apenas **4 seed agents YAML** existem (vs 67 prometidos no PRD/SPEC-014).
- Apenas **6 MCPs built-in** possuem binário real (vs 19+ no PRD/SPEC-008).
- A busca vetorial ainda usa **cosseno em JavaScript O(n)** e depende de uma tabela `vec0` que não é criada automaticamente.
- **Harness e Pipeline** têm domínio/infra/UI, mas a execução automática por IA é parcial/simplificada.
- Várias UIs secundárias estão incompletas: Memory, Permissions, Channels, Audit log, Pipeline report.
- Os testes falham quando executados sem cache devido a **incompatibilidade de ABI do better-sqlite3** (compilado para Node 24, ambiente em Node 22).

**Veredito:** O projeto está tecnicamente sólido, mas não está pronto para v1.0. Recomenda-se uma passada de reconciliação PRD ↔ FEATURE_MATRIX ↔ código antes de declarar release.

---

## 2. Funcionalidades do LionClaw NÃO Mapeadas no Wolfkrow

Abaixo estão funcionalidades existentes no LionClaw v1.0 que **não constam** no PRD, FEATURE_MATRIX ou specs do Wolfkrow, ou foram explicitamente deixadas de fora sem registro formal.

| # | Funcionalidade LionClaw | Onde existe no LionClaw | Status no Wolfkrow | Risco |
|---|-------------------------|--------------------------|--------------------|-------|
| 1 | **Google Drive MCP** | `mcp-servers/google-drive` | Não mapeado; só Calendar/Gmail no Wolfkrow | Alto — usuários do LionClaw perdem integração |
| 2 | **Google Sheets MCP** | `mcp-servers/google-sheets` | Não mapeado | Alto |
| 3 | **Shopify MCP** | `mcp-servers/shopify` | PLANNED no FEATURE_MATRIX, sem binário | Médio |
| 4 | **Nano Banana (geração de imagens)** | `mcp-servers/nano-banana` | PLANNED, sem binário | Médio |
| 5 | **Higgsfield (imagens/vídeos)** | MCP remoto seed | Não mapeado | Médio |
| 6 | **Blotato (social posting)** | MCP remoto seed | Não mapeado | Médio |
| 7 | **Memory Graph (mgraph)** | Tela `GraphPage`, tabela `ingest_jobs`, MCP `graph-search` | Existe Graph page e graph-search MCP, mas não o vault de notas com backlinks do LionClaw | Médio — funcionalidade diferente com mesmo nome |
| 8 | **Geração/edição de imagens inline** | IPC `image:generate`, `image:edit` | Não mapeado | Médio |
| 9 | **Excalidraw inline no chat** | IPC/ferramenta de artefato | PLANNED, sem binário | Médio |
| 10 | **NotebookEdit tool** | `TOOL_CATALOG` | Não implementada | Médio |
| 11 | **Agent tool (invocação de sub-agentes)** | `TOOL_CATALOG` | Não implementada como tool nativa; sub-agentes só via runtime | Médio |
| 12 | **WebSearch / WebFetch como tools nativas** | `TOOL_CATALOG` | Existe `WebTool`, mas funcionalidade pode não cobrir ambas | Baixo |
| 13 | **Slack/Discord/WhatsApp placeholders** | Tela Channels | Channels page só Telegram; placeholders não existem | Baixo |
| 14 | **Pricing calculator multi-fonte** | IPC `pricing:calculate` | ⛔ não iniciado | Médio |
| 15 | **Audit log UI** | Tela `LogsPage` + `audit_log` table | Schema+port ✅, UI ⛔ | Médio |
| 16 | **Pipeline report final** | Pipeline UI | Use-case existe, UI ⛔ | Médio |
| 17 | **Artifact detection genérica** | Tool results renderizam artefatos | ⛔ não iniciado | Médio |
| 18 | **Session management completo** (criar/listar/arquivar/deletar) | `ChatPage` sidebar | 🟡 persistência parcial | Médio |
| 19 | **Export/import encrypted backup do Vault** | Vault UI/settings | Não mapeado | Baixo |
| 20 | **Citation inline no Knowledge** | Respostas citam chunk IDs | Não mapeado explicitamente | Médio |
| 21 | **Knowledge benchmark suite** | UI + tabela `knowledge_benchmarks` | ⛔ removido intencionalmente | Baixo |
| 22 | **Diff visualization no Harness** | Harness UI | Não mapeado | Médio |
| 23 | **Branching/approve with edits no Pipeline** | Pipeline UI | Não mapeado | Médio |
| 24 | **Auto-updater funcional** | `autoUpdater` inicializa, mas sem feed | ✅ inicializado, mas feed não verificado | Baixo |
| 25 | **TOTP próprio (RFC 6238) sem otplib** | Implementação própria | Usa `otplib` — é uma melhoria, mas diferente | Baixo |

### Observações importantes

- O PRD do Wolfkrow menciona "19+ integrações via MCP", mas a FEATURE_MATRIX honestamente lista apenas 6 built-in + 9 planned. Essa discrepância entre PRD e FEATURE_MATRIX precisa ser resolvida.
- O LionClaw tem um ecossistema de **MCPs remotos** (Higgsfield, Blotato) que são omitidos no Wolfkrow.
- A funcionalidade de **Memory Graph** do LionClaw é um vault de notas com backlinks; no Wolfkrow, o termo "Graph" foi reusado para uma visualização D3 de nós/arestas, que pode não ter a mesma semântica.

---

## 3. Itens Mapeados que NÃO Foram Implementados

Estes são itens que aparecem no PRD, FEATURE_MATRIX ou specs, mas que não estão completos no código.

### 3.1 Alto impacto

| # | Item | Onde está mapeado | Evidência no código | Impacto |
|---|------|-------------------|---------------------|---------|
| 1 | **67 seed agents YAML** | PRD 2.1.2, SPEC-014, ADR-0024, AGENT.md | `.wolfkrow/agents/` tem apenas 4 arquivos | Alto — biblioteca de especialistas inexistente |
| 2 | **19 MCPs bundled** | PRD 2.1.4, SPEC-008 | `packages/mcp-servers/` tem apenas 6 pacotes reais | Alto — promessa de ecossistema não cumprida |
| 3 | **sqlite-vec `vec0` vector search** | PRD 2.1.5, ADR-0016, ADR-0028, ARCHITECTURE.md | `knowledge-chunk-repo.ts` verifica `hasVec0Table()` mas tabela não é criada na migration; busca cai em JS O(n) | Alto — performance degradada com grande corpus |
| 4 | **Harness execução AI automática** | PRD 2.1.10, SPEC-005, FEATURE_MATRIX #16 | `runHarnessFeature()` existe, mas FEATURE_MATRIX marca "sem execução AI automática" | Alto — loop Coder→Evaluator existe, mas planner/geração de sprints pode ser manual |
| 5 | **Pipeline execução IA por fase** | PRD 2.1.11, SPEC-006, FEATURE_MATRIX #17 | Templates e UI existem, mas execução automática de fases é parcial | Alto |
| 6 | **Knowledge benchmark suite** | PRD 2.1.5 | FEATURE_MATRIX #22 marca ⛔ removido intencionalmente | Médio — métrica de sucesso do PRD não pode ser medida |

### 3.2 Médio impacto

| # | Item | Onde está mapeado | Evidência no código | Impacto |
|---|------|-------------------|---------------------|---------|
| 7 | **Pipeline report UI** | SPEC-006, FEATURE_MATRIX #37 | Use-case `GeneratePipelineReportUseCase` existe, mas UI ⛔ | Médio |
| 8 | **Pricing calculator** | SPEC-018, FEATURE_MATRIX #40 | ⛔ não iniciado | Médio |
| 9 | **Audit log UI** | SPEC-020, FEATURE_MATRIX #38 | Schema+port ✅, UI ⛔ | Médio |
| 10 | **Memory UI avançada** (compaction trigger, daily summaries) | SPEC-015, FEATURE_MATRIX #29 | UI básica; sem compaction manual | Médio |
| 11 | **Channels/Permissions UI completas** | SPEC-010, SPEC-020 | Pairing básico; gerenciamento parcial | Médio |
| 12 | **Excalidraw inline no chat** | SPEC-002, FEATURE_MATRIX #34 | ⛔ não iniciado | Médio |
| 13 | **Artifact detection** | SPEC-002, FEATURE_MATRIX #36 | ⛔ não iniciado | Médio |
| 14 | **Spec build/validate/enrich seed agents** | SPEC-016, FEATURE_MATRIX #20 | ⛔ não iniciado | Médio |
| 15 | **Google Drive/Sheets MCPs** | PRD 2.1.4 | PLANNED, sem binário | Médio |
| 16 | **ElevenLabs MCP** | PRD 2.1.4 | PLANNED, sem binário; TTS existe via provider | Médio |
| 17 | **Local agents / Local LLM MCPs** | PRD 2.1.4 | PLANNED, sem binário | Médio |
| 18 | **Memory search MCP** | PRD 2.1.4 | PLANNED, sem binário | Médio |
| 19 | **wolfkrow-user-question MCP** | PRD 2.1.4 | PLANNED, sem binário | Baixo |
| 20 | **Google/Groq providers diretos** | FEATURE_MATRIX providers | ⛔ stubs; direcionados para OpenRouter | Baixo |
| 21 | **Export/import encrypted backup do Vault** | PRD 2.1.14 | Não implementado | Médio |
| 22 | **Citation inline no Knowledge** | PRD 2.1.5 | Não implementado | Médio |
| 23 | **Diff visualization no Harness** | PRD 2.1.10 | Não implementado | Médio |
| 24 | **Branching/approve with edits no Pipeline** | PRD 2.1.11 | Não implementado | Médio |
| 25 | **Calendar view + kanban view no Scheduler** | PRD 2.1.9 | Kanban ✅, calendar ✅ Task 12; verificar se ambos estão funcionais | Baixo |
| 26 | **Session management completo** | SPEC-002, FEATURE_MATRIX #8 | 🟡 in-memory; persistência parcial | Médio |
| 27 | **Voice latência <500ms end-to-end** | PRD 2.1.8 | Implementado, mas depende de redes externas; não há garantia | Baixo |

### 3.3 Itens marcados como "fora do escopo v1" no FEATURE_MATRIX

O FEATURE_MATRIX lista ~5 itens como ⛔ não iniciados (out-of-scope v1):
- Excalidraw inline (#34)
- Artifact detection (#36)
- Pipeline report (#37)
- Pricing calculator (#40)
- Knowledge benchmark (#22, removido intencionalmente)

**Problema:** O PRD v1.0 (seção 2.1) lista Knowledge benchmark, Pipeline report e Excalidraw como parte do MVP. Há conflito interno entre PRD e FEATURE_MATRIX que precisa ser reconciliado.

---

## 4. Itens Implementados Fora dos Padrões do Projeto

A arquitetura definida em `ARCHITECTURE.md` e `AGENT.md` impõe Clean Architecture com 4 camadas. A auditoria encontrou desvios que devem ser corrigidos.

### 4.1 Violações arquiteturais

| # | Problema | Localização | Padrão esperado | Severidade |
|---|----------|-------------|-----------------|------------|
| 1 | **Web importa infraestrutura** indiretamente via `apps/web/lib/auth.ts` | `apps/web/lib/auth.ts` | `apps/web/` deveria importar apenas `domain/` + `use-cases/` + client-safe `infra/` | Média |
| 2 | **`getScheduledTasksRepository()` retorna objeto inline** em vez de classe Repo | `packages/infra/src/repos/index.ts` | Todos os repos devem seguir o padrão `DrizzleXxxRepo` | Baixa |
| 3 | **`DrizzleMcpServerRepo` instanciado inline no worker index** | `apps/worker/src/index.ts:28` | Deveria vir do registry/container | Baixa |
| 4 | **`SendMessageUseCase` não publica eventos de domínio** | `packages/use-cases/src/chat/send-message.ts` | Conforme ADR-0025 e fluxo em ARCHITECTURE.md 4.1, deveria publicar `MessageSentEvent` | Média |
| 5 | **Permission store in-process** (memória do worker) | `apps/worker/src/chat/permission-store.ts` | Funciona para single-process, mas é tech debt documentado (T17) | Média |

### 4.2 Desvios de código/qualidade

| # | Problema | Localização | Padrão esperado | Severidade |
|---|----------|-------------|-----------------|------------|
| 6 | **Componente god-class** `chat-view.tsx` com 322 linhas e desabilitação de `max-lines` | `apps/web/components/chat/chat-view.tsx` | Max 50 linhas por função (AGENT.md) | Média |
| 7 | **Override de ESLint** `exhaustive-deps` em `terminal.tsx` | `apps/web/components/terminal/terminal.tsx:58` | ESLint passa, mas com supressão não documentada | Baixa |
| 8 | **Uso de `any` no service worker** | `apps/web/src/sw.ts:19-20` | AGENT.md proíbe `any`; usar `unknown` + type guard | Baixa |
| 9 | **Função longa `makeCoderWithTools` e helpers** (~242 linhas) | `apps/worker/src/container.ts` | Próximo do limite de 50 linhas por função | Baixa |
| 10 | **Console.warn/error no wrapper** | `apps/wrapper/src/main.ts` | Deveria usar Pino logger | Baixa |
| 11 | **FIX-020 comentado** — handler global de erros apenas loga | `apps/worker/src/index.ts:22-24` | Deveria ter tratamento estruturado | Baixa |
| 12 | **Abort signal não repassado ao provider em agentic stream** | `apps/worker/src/routes/chat.ts:145-156` | Botão "Stop" pode não funcionar em todos os cenários | Média |
| 13 | **Testes skipados condicionalmente** (vec0 e built-in MCPs) | `knowledge-benchmark.test.ts`, `mcp-built-in-servers.test.ts` | Testes devem passar de forma determinística | Baixa |

---

## 5. Bugs e Dívidas Técnicas

### 5.1 Bugs confirmados

| # | Bug | Evidência | Severidade | Ação recomendada |
|---|-----|-----------|------------|------------------|
| 1 | **better-sqlite3 compilado contra Node 24 (ABI 137), ambiente Node 22 (ABI 127)** | `pnpm exec turbo test --force` falha em 29 testes do `@wolfkrow/infra` com erro de ABI mismatch | **Crítica** | Recompilar/reinstalar `better-sqlite3` no Node 22; documentar Node exato no `.nvmrc`; adicionar CI matrix |
| 2 | **Tabela `knowledge_chunks_vec` (vec0) não é criada na migration** | `knowledge-chunk-repo.ts` verifica `hasVec0Table()` e fallback para JS O(n); migrations não criam a tabela virtual | Alta | Adicionar migration que cria `vec0` virtual table e load extension `sqlite-vec` |
| 3 | **Permission store in-process perde requests se worker reiniciar** | `permission-store.ts` armazena em `Map` em memória | Média | Persistir requests pendentes ou usar stateless token de confirmação |
| 4 | **Botão "Stop" pode não abortar agentic streams** | `chat.ts:145-156` cria `AbortController` mas não propaga signal ao provider em todos os caminhos | Média | Garantir que `signal` seja passado para `provider.query()` |

### 5.2 Dívidas técnicas

| # | Dívida técnica | Evidência | Risco |
|---|----------------|-----------|-------|
| 1 | **Apenas 2 migrations para 35 tabelas** | `packages/infra/drizzle/migrations/` | Evolução do schema ainda curta; risco de drift |
| 2 | **Seed agents e skills hardcoded vs arquivo YAML** | `.wolfkrow/agents/` (4 arquivos); `built-in-skills.ts` hardcoded | Dificulta manutenção e personalização pelo usuário |
| 3 | **Harness/Pipeline execução automática incompleta** | FEATURE_MATRIX #16, #17 | Usuário não terá experiência "descreva e implemente" prometida no PRD |
| 4 | **EventBus subutilizado** | `SendMessageUseCase` não publica eventos | Quebra desacoplamento previsto em ADR-0025 |
| 5 | **Console logging no wrapper** | `apps/wrapper/src/main.ts` | Falta observabilidade estruturada |
| 6 | **Componentes grandes e overrides de ESLint** | `chat-view.tsx`, `terminal.tsx` | Degrada manutenibilidade |
| 7 | **Turborepo cache oculta falhas de teste** | `pnpm test` passa com cache; `pnpm exec turbo test --force` falha | Risco de merges com testes quebrados |
| 8 | **Auto-update sem feed configurado** | `electron-builder.yml` sem bloco `publish` (padrão herdado do LionClaw) | Auto-updater não funciona em produção |
| 9 | **MCPs planned sem binário aparecem no catalog** | FEATURE_MATRIX lista 9 PLANNED | Risco de confusão do usuário; documentar como "em breve" |
| 10 | **Workflow domain/use-cases sem rotas/UI** | ADR-0027 declara "workflow vivo", mas não há HTTP routes | Código morto/underutilizado |

---

## 6. Pontos Fora do Escopo do Projeto

O PRD define claramente os não-objetivos do v1.0 (seção 3):

- ❌ Multi-tenant
- ❌ Cloud-hosted
- ❌ Mobile-first
- ❌ Real-time collaboration
- ❌ Voice cloning
- ❌ Fine-tuning de modelos

**Observações da auditoria:**

1. **PWA installable** está implementado e é citado como bônus no PRD — isso está OK, desde que não substitua a experiência desktop.
2. **Electron wrapper** está implementado, mas o **hotkey global** e **screen awareness** aparecem apenas no roadmap v1.1+/v1.2+, não no escopo v1.0 — correto.
3. **OpenRouter como substituto de Z.ai/Google/Minimax** é uma decisão de escopo válida documentada em `MIGRATION_FROM_LIONCLAW.md`.
4. **Knowledge benchmark removido** é uma decisão de escopo, mas conflita com o PRD e com a métrica de sucesso "retrieval precision@5 > 0.80".

**Recomendação:** Atualizar o PRD para refletir as decisões de escopo reais (ex: remover knowledge benchmark do MVP, reduzir MCPs bundled para 6 + planned, etc.).

---

## 7. Oportunidades de Otimização e Melhoria

### 7.1 Performance

| # | Oportunidade | Impacto esperado | Esforço |
|---|--------------|------------------|---------|
| 1 | **Implementar sqlite-vec `vec0` de forma definitiva** | Busca vetorial O(log n) em vez de O(n); escala para milhares de chunks | Médio |
| 2 | **Adicionar FTS5 para keyword search** | Busca por keyword mais rápida e relevante que `LIKE '%query%'` | Médio |
| 3 | **Batch inserts otimizados** | Embeddings em batches maiores reduzem I/O | Baixo |
| 4 | **Virtualização de listas longas** | PRD/ARCHITECTURE mencionam react-window; verificar implementação | Baixo |
| 5 | **Lazy loading do voice engine** | Já parcialmente implementado; confirmar | Baixo |

### 7.2 Arquitetura e qualidade

| # | Oportunidade | Impacto esperado | Esforço |
|---|--------------|------------------|---------|
| 6 | **Quebrar `chat-view.tsx`** em sub-componentes | Melhor testabilidade e manutenibilidade | Médio |
| 7 | **Adicionar EventBus em `SendMessageUseCase`** | Desacoplar title generation, usage tracking, compaction check | Médio |
| 8 | **Padronizar todos os repos como classes** | Consistência arquitetural | Baixo |
| 9 | **Remover `any` do service worker** | Conformidade com AGENT.md | Baixo |
| 10 | **Adicionar cobertura de testes por pacote** | Garantir ≥85% domain, ≥90% use-cases, ≥85% worker | Médio |
| 11 | **Executar CI com `turbo test --force`** | Evitar cache ocultando falhas | Baixo |
| 12 | **Documentar `.nvmrc` e requisito exato de Node** | Evitar ABI mismatch | Baixo |

### 7.3 Produto

| # | Oportunidade | Impacto esperado | Esforço |
|---|--------------|------------------|---------|
| 13 | **Migrar 67 seed agents do LionClaw** | Recuperar biblioteca de especialistas | Alto |
| 14 | **Finalizar 9 MCPs planned** | Cumprir promessa de 19 MCPs | Alto |
| 15 | **Completar UIs secundárias** (Memory, Permissions, Channels, Audit log, Pipeline report) | Experiência completa do produto | Médio |
| 16 | **Implementar execução automática de Harness/Pipeline** | Diferencial competitivo do PRD | Alto |
| 17 | **Adicionar diff visualization no Harness** | Melhor UX de review | Médio |
| 18 | **Adicionar citation inline no Knowledge** | Confiança nas respostas RAG | Médio |
| 19 | **Carregar skills de `.wolfkrow/skills/*.md`** | Customização pelo usuário | Médio |
| 20 | **Resolver conflito PRD vs FEATURE_MATRIX** | Alinhamento de expectativas | Baixo |

---

## 8. Verificações de Qualidade Executadas

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Lint | `pnpm lint` | ✅ 15/15 tarefas (cache hit) |
| Typecheck | `pnpm typecheck` | ✅ 21/21 tarefas (cache hit) |
| Testes com cache | `pnpm test` | ✅ 16/16 tarefas (cache hit) |
| Testes sem cache | `pnpm exec turbo test --force` | ❌ `@wolfkrow/infra#test` falhou — 29 testes com erro de ABI do better-sqlite3 |

**Conclusão das verificações:** Lint e typecheck passam, mas os testes reais de infraestrutura não executam no ambiente atual devido a incompatibilidade do módulo nativo better-sqlite3. Isso é um sinal de alerta para CI/CD e novos contribuidores.

---

## 9. Recomendações Prioritárias

### P0 — Crítico (bloqueia v1.0)

1. **Corrigir ABI mismatch do better-sqlite3** — recompilar para Node 22, documentar `.nvmrc`, e garantir CI matrix.
2. **Reconciliar PRD com FEATURE_MATRIX** — decidir se 19 MCPs e 67 seed agents são v1.0 ou roadmap.
3. **Implementar criação da tabela `knowledge_chunks_vec`** na migration e carregar extensão sqlite-vec.
4. **Completar seed agents YAML** ou reduzir escopo documentado.
5. **Finalizar MCPs built-in** ou ajustar documentação para refletir 6 built-in + planned.

### P1 — Alto

6. Implementar EventBus em `SendMessageUseCase`.
7. Garantir abort signal propagation em todos os providers.
8. Finalizar UI de Memory (compaction manual, daily summaries).
9. Implementar Pipeline report UI.
10. Implementar Audit log UI.
11. Melhorar Channels/Permissions UI.
12. Adicionar diff visualization no Harness.
13. Adicionar citation inline no Knowledge.

### P2 — Médio

14. Quebrar componentes grandes (`chat-view.tsx`).
15. Carregar skills de `.wolfkrow/skills/*.md` em vez de hardcoded.
16. Padronizar repos inline como classes.
17. Remover `any` do service worker.
18. Substituir console.warn/error no wrapper por Pino.
19. Adicionar mais migrations conforme schema evolui.
20. Implementar rotas HTTP/UI para Workflow (já que ADR-0027 declarou "vivo").

### P3 — Baixo

21. Documentar overrides de ESLint.
22. Melhorar testes skipados (vec0, built-in MCPs).
23. Adicionar feed de auto-update no `electron-builder.yml`.
24. Revisar nomenclatura "Graph" para não confundir com Memory Graph do LionClaw.

---

## 10. Conclusão

O Wolfkrow-tool é um projeto ambicioso, bem arquitetado e com documentação de alta qualidade. A migração do LionClaw para Next.js + Clean Architecture é tecnicamente sólida e a implementação já cobre a maior parte das funcionalidades core (chat, auth, agents, skills, knowledge básico, scheduler, voice, vault, PTY).

Os principais riscos para a v1.0 são:

1. **Escopo documentado vs entregue**: discrepâncias entre PRD, FEATURE_MATRIX e código real.
2. **Infraestrutura de testes**: ABI mismatch do better-sqlite3 pode quebrar CI e novos ambientes.
3. **Performance do RAG**: busca vetorial em JavaScript O(n) não escala.
4. **Execução automática de Harness/Pipeline**: ainda parcial, impactando o diferencial do produto.
5. **UX secundária incompleta**: Memory, Permissions, Channels, Audit log e Pipeline report carecem de UI.

Com as correções prioritárias aplicadas, o projeto estará muito próximo de uma v1.0 robusta e alinhada com a visão do LionClaw refatorado.
