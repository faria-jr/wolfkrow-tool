# Final Plan — Correção dos achados da Auditoria Verificada

**Base:** `docs/AUDITORIA_VERIFICADA_2026-06-24.md`
**Objetivo:** Levar wolfkrow-tool a release v1.0 com paridade LionClaw real, contratos íntegros e segurança fechada.
**Convenções:** Todo item segue TDD (RED→GREEN→REFACTOR). Thresholds: backend/worker ≥85%, frontend ≥70%. Nada de schema escrito direto — Zod nos boundaries (ADR-0005).

**Legenda prioridade:** 🔴 P0 = gate de release · 🟠 P1 = qualidade obrigatória · 🟡 P2 = paridade/UX · 🔵 P3 = governança.

---

## Fase 0 — Gates de Release (🔴 P0)

### P0-1 — Seed agents nunca são seedados em runtime (loader órfão)

**Descrição.** Existem 72 definições YAML (`.wolfkrow/agents/*.yaml`) + `loadSeedAgents` + schema + teste, mas `loadSeedAgents` só é chamado pelo próprio teste. Não há seeder no startup, nem script `seed:agents` no worker. Resultado: usuário inicia o produto com **0 agentes** (LionClaw vinha com ~68). É o gap de paridade real.

**Causa raiz.** `apps/worker/src/seed-agents/loader.ts` desconectado do ciclo de vida. `package.json` raiz tem `seed:agents` delegando a `@wolfkrow/worker seed:agents` — script inexistente no worker (`pnpm seed:agents` falha).

**Arquivos.**
- `apps/worker/src/seed-agents/loader.ts` (loader existente)
- `apps/worker/src/index.ts` (`main()`, linhas 48-68 — após `runMigrations()`/`getDb()`)
- `packages/infra/src/repos/agent-repo.ts` (upsert)
- `packages/infra/src/db/schema/agents.ts` (`userId` é `notNull` → seeding precisa de owner)
- `apps/worker/package.json` (script `seed:agents`)

**O que fazer.**
1. Criar `apps/worker/src/seed-agents/seeder.ts` com `seedAgents({ repo, userId, dir })`:
   - `const defs = await loadSeedAgents(dir)`
   - para cada def: **upsert idempotente por (`userId`, `name`)** — não duplicar em reinício; não sobrescrever edições do usuário (só inserir se ausente). Mapear `SeedAgent` → colunas da tabela `agents` (campos batem 1:1; setar `provider`/`squad` conforme YAML).
2. Resolver o problema do `userId notNull`: seed deve rodar **após o onboarding criar o primeiro usuário**. Opções:
   - (recomendado) chamar `seedAgents` no fim do fluxo de onboarding (primeiro setup de senha), com o `userId` recém-criado; **ou**
   - seeder no startup do worker que detecta usuários sem agentes e popula (`for each user with agentCount==0: seed`).
3. Wirear no `main()` do worker (ou no handler de onboarding) — diretório = path resolvido do symlink `apps/worker/src/seed-agents/yaml` → `.wolfkrow/agents`.
4. Adicionar script real: `apps/worker/package.json` → `"seed:agents": "tsx src/seed-agents/cli.ts"` (CLI que aceita `--user <id>`), para reseed manual.

**Aceitação.**
- Após onboarding fresh, tabela `agents` contém 72 agentes do usuário.
- Reiniciar worker N vezes → sem duplicatas (idempotente).
- Editar/remover agente seedado → reseed não o ressuscita/sobrescreve.
- Teste de integração: `seedAgents` 2× → count estável; `pnpm seed:agents --user X` funciona.

**Esforço:** M.

---

### P0-2 — SSRF: bypass por IP numérico (decimal/octal/hex)

**Descrição.** `validateBaseUrl` valida host por regex de string. IPs em forma numérica não-pontilhada escapam: `http://2130706433/` (=127.0.0.1), `http://0177.0.0.1/` (octal), `http://0x7f000001/` (hex). Permite alcançar loopback/metadata interno (ex.: `169.254.169.254`) por provider custom.

**Causa raiz.** `isPrivateIPv4`/`isLoopbackHost` comparam string crua sem normalizar representações numéricas (`packages/domain/src/value-objects/provider-config.ts:12-19, 79-84`).

**Arquivos.** `packages/domain/src/value-objects/provider-config.ts`.

**O que fazer.**
1. Adicionar `normalizeIpv4(hostname): string | null` que canonicaliza:
   - inteiro único de 32 bits (`2130706433` → `127.0.0.1`),
   - octal por octeto (`0177.0.0.1`),
   - hex (`0x7f000001`),
   - formas mistas (`127.1`, `0x7f.1`).
   Usar `BigInt`/`parseInt(radix)` por octeto; rejeitar overflow.
2. Em `isPrivateHost`/`isLoopbackAny`: antes do match, se `normalizeIpv4` retornar IP, usar o **canônico** nas regras.
3. (Defesa adicional, recomendado para http→provider) resolver hostname via `node:dns.promises.lookup` no momento da requisição e revalidar o IP resolvido (bloqueia DNS rebinding). Como `provider-config` é domain puro, fazer a checagem DNS no adapter de infra que cria a conexão (`packages/infra/src/ai-providers/*`).

**Aceitação.** Testes RED→GREEN cobrindo: decimal, octal, hex, misto, `[::ffff:7f00:1]`, e casos válidos (https público passa). `pnpm test` verde em `provider-config.test.ts`.

**Esforço:** S-M.

---

### P0-3 — Evento SSE `ask_question` morto (feature quebrada end-to-end)

**Descrição.** Frontend completo (`sse.ts:10,48`, `chat-hooks.ts:139`, `chat-view.tsx:136` renderiza `AskQuestionDialog`, teste em `chat-view.test.tsx:192`). Worker **nunca emite** `ask_question` (`grep -rn ask_question apps/worker/src` = vazio). Teste passa porque mocka o SSE — mascara feature morta.

**Causa raiz.** Loop agêntico do worker não tem caminho para a tool/sinal "perguntar ao usuário" emitir o evento SSE.

**Arquivos.**
- Emissor SSE do chat no worker: `apps/worker/src/routes/chat.ts` + camada de stream do orchestrator (`apps/worker/src/orchestrator.ts`, `apps/worker/src/chat/*`).
- Contrato: adicionar evento ao schema SSE compartilhado (ver P1-1).

**O que fazer (escolher 1).**
- **(A) Implementar:** quando o agente invoca a tool de pergunta (ou retorna marcador estruturado), emitir frame SSE `{ type: 'ask_question', prompt }` e **pausar** o stream aguardando resposta do usuário (canal de resposta via endpoint/turn seguinte). Reentrar no loop com a resposta.
- **(B) Remover** o handler morto do frontend (`sse.ts:10,48`, `chat-hooks` pendingQuestion, dialog, teste) se a feature for descopada para v1.1 — **documentar no FEATURE_MATRIX**.

**Recomendação:** (B) para v1.0 (menor risco) + ticket explícito para (A) em v1.1, OU (A) se houver demanda. Não deixar código morto sem decisão.

**Aceitação.** Teste e2e **real** (não mockado): agente dispara pergunta → dialog aparece → resposta retoma o turno. Se (B): grep `ask_question` zerado em todo o repo e MATRIX atualizada.

**Esforço:** A=L · B=S.

---

### P0-4 — `/usage/summary` retorna 3 shapes incompatíveis

**Descrição.** Frontend espera `totalInputTokens`/`totalOutputTokens`/`totalCostUSD`/`byDay: Record` (`usage-charts.tsx:20-25`). Schema compartilhado define `totalTokens`/`totalCost`/`totalRequests`/`byDay: array` (`shared-types/src/schemas/usage.ts:57-62`). Worker devolve `computeUC.execute(...)` cru, sem parse (`apps/worker/src/routes/usage.ts:46`). Três contratos para o mesmo endpoint.

**Causa raiz.** Schema Zod não importado em nenhum lado; cada camada inventou shape.

**Arquivos.** `packages/shared-types/src/schemas/usage.ts`, `packages/use-cases/src/usage/*`, `apps/worker/src/routes/usage.ts`, `apps/web/components/usage/usage-charts.tsx`.

**O que fazer.**
1. Definir **um** `UsageSummarySchema` canônico em shared-types (decidir nomes finais; sugerido manter `totalInputTokens`/`totalOutputTokens`/`totalCostUSD` + `byDay` como array de `{ day, inputTokens, outputTokens, costUSD }`).
2. Use-case `computeUsage` retorna exatamente esse shape; worker faz `UsageSummarySchema.parse(result)` antes de `reply.send`.
3. Frontend importa `UsageSummary` do shared-types e adapta o gráfico (array em vez de Record).
4. Atualizar `usage-charts.test.tsx` para o shape canônico.

**Aceitação.** Um único tipo importado nos 3 lados; `parse()` no worker; gráfico renderiza com dados reais; testes verdes.

**Esforço:** M.

---

### P0-5 — 7 rotas `/settings/*` retornam 404 + navegação dupla

**Descrição.** `settings-shell.tsx:9-17` declara 9 tabs (`providers`, `vault`, `agents`, `mcp`, `automation`, `rules`, `permissions`, `channels`, `usage`); só existem `app/(app)/settings/page.tsx` e `settings/providers/page.tsx`. As outras 7 → 404. Além disso `settings/page.tsx` tem cards de navegação que conflitam com as tabs.

**Causa raiz.** Shell de tabs criado antes/sem as rotas; duas fontes de navegação.

**Arquivos.** `apps/web/components/settings/settings-shell.tsx`, `apps/web/app/(app)/settings/*`.

**O que fazer (escolher 1, sem ambiguidade).**
- **(A)** As funcionalidades já existem como páginas top-level (`/vault`, `/agents`, `/mcp-servers`, `/rules`, `/permissions`, `/channels`, `/usage`, `/scheduler`). Então: **remover as tabs mortas** do shell e manter Settings como hub que linka para essas rotas existentes (cards), eliminando duplicação. Mais simples e já funcional.
- **(B)** Criar as 7 rotas `/settings/*` como wrappers que reusam os mesmos componentes das páginas top-level. Mais trabalho, duplica nav.

**Recomendação:** (A). Garantir 1 só padrão de navegação.

**Aceitação.** Zero 404 ao clicar qualquer item de Settings. Navegação única e consistente. Teste e2e clicando todos os links de Settings.

**Esforço:** S.

---

### P0-6 — Contrato de login: schema ≠ handler

**Descrição.** `LoginResponseSchema` (`shared-types/src/schemas/auth.ts:119-126`) exige `challengeId: UuidSchema` para `status: 'requires_totp'`; handler retorna `{ status: 'requires_totp', userId }` (`app/api/auth/login/route.ts:78`). Contrato de autenticação quebrado.

**Arquivos.** `packages/shared-types/src/schemas/auth.ts`, `apps/web/app/api/auth/login/route.ts`, consumidores do fluxo TOTP (`unlock`/`totp`).

**O que fazer.** Decidir o campo correto (provavelmente `userId` é o real usado no passo TOTP) e alinhar schema ↔ handler ↔ frontend. Fazer o handler `LoginResponseSchema.parse(payload)` antes de responder.

**Aceitação.** `parse()` no handler passa; fluxo login→TOTP→unlock funciona em teste; schema reflete realidade.

**Esforço:** S.

---

### P0-7 — `/logs/stream` sem autenticação

**Descrição.** `apps/worker/src/routes/logs.ts` não tem `onRequest: [app.authenticate]` (rotas vizinhas têm — `knowledge.ts:80,84,94,104`). Proxy web (`app/api/logs/stream/route.ts`) não repassa cookie. Logs do sistema podem vazar sem sessão.

**Arquivos.** `apps/worker/src/routes/logs.ts`, `apps/web/app/api/logs/stream/route.ts`.

**O que fazer.**
1. Adicionar `onRequest: [app.authenticate]` na(s) rota(s) de logs do worker.
2. Garantir que o proxy web encaminhe o cookie/sessão (igual aos demais proxies autenticados).

**Aceitação.** Request sem sessão → 401. Com sessão → stream OK. Teste cobrindo ambos.

**Esforço:** S.

---

## Fase 1 — Qualidade Obrigatória (🟠 P1)

### P1-1 — Ativar Zod nos boundaries (eliminar shadow schemas) — ADR-0005

**Descrição.** ~20 schemas Zod em `packages/shared-types/src/schemas/` não são usados para validação. Worker importa só constantes (`grep @wolfkrow/shared-types apps/worker/src` → 4 hits, todos `DEFAULT_*_MODEL`). `chat.ts` aceita body sem validar. Viola ADR-0005 (Zod single source of truth) e é a causa-raiz de P0-4/P0-6.

**Arquivos.** Todas as rotas do worker (`apps/worker/src/routes/*.ts`) e route handlers web (`apps/web/app/api/**/route.ts`).

**O que fazer.**
1. Em cada boundary: `const data = XSchema.parse(await req.json()/body)` na entrada; `YSchema.parse(payload)` na saída.
2. Remover schemas inline reescritos no worker (`vault.ts`, `knowledge.ts`, `usage.ts`, `chat.ts`) — importar dos shared.
3. Onde faltar schema, criar no shared-types.
4. Mapear erro de validação Zod → 400 padronizado.

**Aceitação.** Cada rota valida entrada/saída via shared schema; nenhum schema duplicado inline; testes de body inválido → 400.

**Esforço:** L.

---

### P1-2 — Elevar threshold de cobertura do worker para 85% (tdd-mandatory)

**Descrição.** `apps/worker/vitest.config.ts:27-31` = 25/25/20/25. Cobertura real **54.7% lines** (`apps/worker/.turbo/turbo-test$colon$cov.log`). CI verde falso na camada HTTP crítica (auth, chat, MCP, vault).

**Arquivos.** `apps/worker/vitest.config.ts` + novos testes de rotas.

**O que fazer.**
1. Escrever testes para as rotas descobertas (auth, chat, vault, mcp-servers, usage, logs) — happy path + erro + autorização.
2. Subir threshold progressivamente até `lines/statements/functions ≥ 85`, `branches ≥ 80`.
3. Remover a exceção leniente.

**Aceitação.** `pnpm --filter @wolfkrow/worker test:cov` passa com threshold 85%.

**Esforço:** L.

---

### P1-3 — Cobrir branches de shared-types (hoje 0% branch)

**Descrição.** `packages/shared-types` com threshold 25% e **0% branch** — schemas (contratos) sem teste de validação válido/inválido.

**O que fazer.** Para cada schema: teste `parse` de payload válido (sucesso) e inválido (lança/`safeParse` falha), cobrindo refinements e discriminated unions. Subir threshold.

**Aceitação.** Branch coverage > 0 e alinhado; cada schema com ≥1 caso válido + ≥1 inválido.

**Esforço:** M.

---

### P1-4 — Remover `knowledge/search` duplicado (handler morto)

**Descrição.** `knowledge/search` existe como route handler web (executa use-case) **e** como route no worker (morto). Divergência futura.

**O que fazer.** Confirmar qual é o caminho vivo (web → use-case). Remover o handler morto do worker. Atualizar testes/imports.

**Aceitação.** Uma só implementação; grep não acha rota duplicada; busca funciona.

**Esforço:** S.

---

### P1-5 — Consolidar fontes de provider/pricing (RM1, DRY)

**Descrição.** 4 fontes divergentes: `provider-registry.ts:33`, `claude-compat-presets.ts:32`, `pricing-calculator.ts:64`, `pricing-calculator.ts:92` + inferência por prefixo em `orchestrator.ts:52`. Risco de preço 0 / lookup falho.

**O que fazer.** Criar fonte única (registry canônico) consumida por presets, pricing e orchestrator. Remover duplicatas.

**Aceitação.** Um registry; pricing e presets derivam dele; testes de lookup por modelo.

**Esforço:** M.

---

### P1-6 — Propagação de abort para tools em execução (Bug #4)

**Descrição.** Stop/abort cancela o HTTP do stream mas a tool em execução continua até o fim (`claude-compat.ts` reportado). Desperdício de trabalho/custo.

**O que fazer.** Passar `AbortSignal` até `executeTool`/`executor.execute()`; checar `signal.aborted` antes de iniciar a tool e abortar I/O em andamento quando suportado.

**Aceitação.** Teste: abortar stream → tool não executa/encerra cedo (spy não chamado ou interrompido).

**Esforço:** M.

---

### P1-7 — Persistir permission store (Bug #3)

**Descrição.** `permission-store.ts:20` é `Map` in-memory; decisões aprovadas somem no restart do worker → re-pergunta a mesma tool. Tabela de permissões já existe.

**O que fazer.** Persistir decisões em DB (upsert por agent+tool+decision) com cache in-memory; carregar no startup.

**Aceitação.** Aprovar tool → restart worker → não repergunta. Teste de persistência.

**Esforço:** M.

---

### P1-8 — Chat não-agentic com provider claude-compat descarta tools (RM3)

**Descrição.** Com provider claude-compat (zai/minimax/moonshot) em modo não-agentic, `factory.create` é chamado sem `toolRegistry` → tools silenciosamente ignoradas (`orchestrator.ts:128-133` vs `chat.ts:88-119`).

**O que fazer.** Usar `createFromConfig` (com toolRegistry) quando provider é claude-compat, ou unificar criação para sempre passar registry.

**Aceitação.** Teste: provider claude-compat executa tool calls.

**Esforço:** M.

---

### P1-9 — Endurecer assertions de testes unitários rasos

**Descrição.** Testes com coverage verde mas assertions fracas que mascaram bugs. Confirmados no código: `mcp-bridge.test.ts:30` (`expect(result.tools).toBeDefined()` aceita `{tools: []}`), `mcp-bridge.test.ts:62` (assimétrico — `r1` só `toBeDefined`, `r2/r3` validados por conteúdo), `seed-agents.test.ts:65` (`it('each agent passes schema validation')` só checa `name`/`model` truthy — não valida `runtime`/`allowedTools`/enums), `auth.test.ts:155` (`toBeTruthy()` aceita `userId: true`), `providers-a2.test.ts:64,95` (`not.toThrow()` no construtor vendido como cobertura de custom baseURL). Cobertura % não garante qualidade de assertion.

**Causa raiz.** Medida de coverage (linhas/branch) não mede se o teste valida **conteúdo/efeito**. Testes verdes com `toBeDefined` passam mesmo com implementação quebrada.

**Arquivos.** `apps/worker/src/__tests__/mcp-bridge.test.ts`, `apps/worker/src/__tests__/seed-agents.test.ts`, `packages/use-cases/src/auth/__tests__/auth.test.ts`, `packages/infra/src/ai-providers/__tests__/providers-a2.test.ts` (+ auditoria completa `grep -rn "toBeDefined\|toBeTruthy\|not.toThrow"` em todos `__tests__`).

**O que fazer.**
1. Auditar todos testes: `grep -rn "\.toBeDefined()\|\.toBeTruthy()\|\.toBeFalsy()\|not\.toThrow()" --include="*.test.*"`. Avaliar cada ocorrência — algumas são legítimas (cheque de presença intencional), a maioria deve virar assertion de conteúdo/valor/tipo.
2. Substituir por assertions concretas: `expect(result.tools).toHaveLength(1)` + `expect(result.tools[0].name).toBe(...)`; `expect(out.userId).toEqual(expect.any(String))`; `expect(provider.baseURL).toBe(customUrl)`.
3. No `seed-agents.test.ts:65`: validar schema completa via `SeedAgentSchema.safeParse(def)` (não só `name`/`model`).
4. Adicionar regra ESLint custom (ou check CI) que sinaliza `toBeDefined/toBeTruthy` em testes (opt-in, revisão manual por enquanto).

**Aceitação.** Zero `toBeDefined/toBeTruthy` como assertion principal de conteúdo (presença intencional documentada); cada teste unitário valida efeito real (valor, shape, ordem, side-effect); `seed-agents` valida schema completa.

**Esforço:** S.

---

## Fase 2 — Paridade & UX Frontend (🟡 P2)

### P2-1 — Permissions page (placeholder → CRUD real)

**Descrição.** `app/(app)/permissions/page.tsx` = 15 linhas de texto estático. LionClaw tinha catálogo allow/deny/ask por agente. Backend de permissões existe.

**O que fazer.** UI de gerenciamento: listar agentes, por agente listar tools com estado allow/deny/ask, editar, persistir via API. Reusar componentes shadcn.

**Aceitação.** CRUD funcional ligado ao backend; reflete decisões persistidas (P1-7).

**Esforço:** M.

---

### P2-2 — Config de voz no Settings (STT/TTS/provider)

**Descrição.** LionClaw tinha seletor STT/TTS/provider de voz no Settings; ausente no wolfkrow (`settings/page.tsx` é só hub). Backend de voz existe (`voice/transcribe`, `voice/synthesize`, factory TTS).

**O que fazer.** Seção de voz: selecionar engine STT (Whisper local/OpenAI), TTS (ElevenLabs/Cartesia), persistir preferências, ligar aos endpoints existentes.

**Aceitação.** Trocar provider de voz reflete no chat (voz orb usa config).

**Esforço:** M.

---

### P2-3 — Pricing calculator UI (SPEC-018)

**Descrição.** Domínio `pricing-calculator.ts` existe; sem UI/wiring. Frontend não expõe estimativa multi-fonte.

**O que fazer.** UI dentro/perto da Usage page: seletor de modelo + input/output tokens → custo estimado, usando o registry consolidado (P1-5).

**Aceitação.** Calcula custo por modelo real; números batem com o domain.

**Esforço:** S-M.

---

### P2-4 — Pipeline report: renderizar markdown (não `<pre>`)

**Descrição.** `pipeline-report-view.tsx:62-66` renderiza markdown como `<pre>` (perde formatação).

**O que fazer.** Trocar por `ReactMarkdown` (já usado no chat). Sanitizar.

**Aceitação.** Report com headings/listas/código formatados.

**Esforço:** S.

---

### P2-5 — SidebarTrigger no topbar (mobile)

**Descrição.** `topbar.tsx` sem `<SidebarTrigger/>` → em mobile a sidebar não abre.

**O que fazer.** Adicionar `<SidebarTrigger/>` no topbar; validar responsivo.

**Aceitação.** Mobile abre/fecha sidebar.

**Esforço:** XS.

---

### P2-6 — Audit log: filtros (severity/dimension/file)

**Descrição.** `findings-table.tsx:21-48` sem filtros. Export CSV/JSON já existe.

**O que fazer.** Adicionar filtros client-side (severity, dimension, file) sobre a tabela.

**Aceitação.** Filtrar reduz linhas corretamente; testes RTL.

**Esforço:** S.

---

### P2-7 — Excalidraw inline no chat (hoje link externo)

**Descrição.** `artifact-card.tsx:71-99` abre Excalidraw como link externo; MATRIX previa inline.

**O que fazer (opcional v1.0).** Embed inline do artefato de desenho, ou manter externo e marcar explicitamente como v1.1 no MATRIX. Decisão de escopo.

**Aceitação.** Inline funcional **ou** descopado documentado.

**Esforço:** M (inline) · XS (descope).

---

### P2-8 — Navegação cobre só ~18/28 páginas

**Descrição.** `usage`/`design`/`terminal`/`enrich` só acessíveis por URL — sem entrada na navegação.

**O que fazer.** Adicionar à sidebar/menu as páginas existentes sem ponto de entrada (decidir agrupamento).

**Aceitação.** Toda página tem rota de navegação descobrível.

**Esforço:** S.

---

### P2-9 — mgraph vault estruturado (decisão de escopo — paridade LionClaw)

**Descrição.** LionClaw tinha vault tipo Obsidian/ROAM (`~/.lionclaw/mgraph/`) com tipos estruturados: entities, meetings, decisions, projects, references — base de conhecimento navegável e relacional. Wolfkrow tem `graph view` (D3, extração de entidades de documentos/links) — equivalente visual, porém **sem os tipos estruturados** (meetings/decisions/projects) como nós de primeira classe. Paridade estrutural reduzida, sem decisão documentada.

**Causa raiz.** Refactor portou o graph de visualização, não o modelo de vault estruturado. Nenhum ADR explicita a redução como intencional.

**Arquivos.** `packages/use-cases/src/graph/*`, `packages/infra/src/db/schema/graph*`, `apps/web/components/graph/*`. Referência LionClaw: `/Users/juniorfaria/projects/lionclawv1.0/electron/main/mgraph-engine.ts`.

**O que fazer (decidir explicitamente — sem deixar ambíguo).**
- **(A) Implementar paridade:** estender schema `graphNodes` com `kind` discriminator (entity/meeting/decision/project/reference) + campos por tipo; UI de criação/edição por tipo; ingestão estruturada (não só extração automática). Consome LionClaw como referência.
- **(B) Descope formal:** documentar no `FEATURE_MATRIX.md` e PRD que o vault estruturado ROAM-like é **intencionalmente não-objetivo v1.0** (graph view cobre o caso de visualização de relações). Adicionar ADR registrando a decisão.

**Recomendação:** **(B) para v1.0** (graph view atual atende uso principal; vault estruturado é escopo L sem demanda confirmada) — registrar ADR. Reverter para (A) se ≥3 usuários pedirem tipos estruturados.

**Aceitação.** Decisão registrada em ADR; FEATURE_MATRIX reflete realidade. Se (A): tipos estruturados criáveis/editáveis no graph; ingestão distingue `kind`.

**Esforço:** (A) L · (B) XS.

---

## Fase 3 — Governança & Hardening (🔵 P3)

### P3-1 — Remover E2E morto / assertions falsas

**Descrição.** `chat.spec.ts:8` `test.skip(()=>false)` nunca skipa; `chat.spec.ts:19` só checa URL; `tasks.spec.ts` não submete form. Viola "teste valida o código".

**O que fazer.** Corrigir ou remover; e2e devem submeter e validar efeito real.

**Esforço:** S-M.

---

### P3-2 — Endurecer `ALLOWED_BINARIES` (shells)

**Descrição.** `bash-tool.ts:18` inclui `bash`/`sh`/`zsh` → agente pode `bash -c 'rm -rf x'` contornando `FORBIDDEN_PATTERNS` (que só bloqueia sudo/chmod).

**O que fazer.** Remover shells do allowlist **ou** validar argumentos de invocações de shell (bloquear `-c` arbitrário / aplicar FORBIDDEN_PATTERNS ao comando interno).

**Esforço:** S.

---

### P3-3 — Reconciliar documentação

**Descrição.** `FEATURE_MATRIX.md` marca ⛔ memory-search UI e artifact-detection que **já existem**. `IMPLEMENTATION_PLAN.md` diz "5% concluído" (irreal). `USER_GUIDE.md` lista features deferred como disponíveis. MEMORY.md sobre tag stale.

**O que fazer.** Atualizar os 3 docs ao estado real do código. Re-tag release (v1.0.0 stale → nova).

**Esforço:** S.

---

### P3-4 — Eliminar warnings `act(...)`

**Descrição.** Warnings em KnowledgeView, AgentsView, SkillsView.

**O que fazer.** Envolver atualizações de estado assíncronas em `act()`/`waitFor` nos testes.

**Esforço:** S.

---

### P3-5 — Busca vetorial nativa (sqlite-vec / vec0)

**Descrição.** Busca atual = keyword LIKE + cosine JS O(n) — não escala >5k chunks (roadmap ADR-0028/T24).

**O que fazer.** Integrar virtual table `vec0` (sqlite-vec) para ANN nativo; manter fallback JS. Opcional v1.0 (otimização).

**Esforço:** L.

---

### P3-6 — RAG ranking parity (rerank + RRF + BM25) — paridade LionClaw

**Descrição.** Busca do knowledge engine hoje = keyword LIKE + cosine JS O(n). LionClaw tinha busca híbrida rica: **BM25 + vector + Reciprocal Rank Fusion + Cohere rerank + HyDE**. Resultado: recall/precisão do wolfkrow muito inferior ao LionClaw para bases médias+.

**Distinto de P3-5.** P3-5 (`vec0`) resolve **performance** (ANN nativo, escala >5k chunks). P3-6 resolve **qualidade de ranking** (ordem/relevância dos resultados). Complementares, não sobrepostos.

**Causa raiz.** ADR-0028 escolheu Voyage embeddings e simplificou a busca; rerank/RRF/HyDE nunca foram portados do LionClaw. `knowledge-hybrid.ts` (189 linhas) faz fusão simples, não RRF com BM25.

**Arquivos.**
- `apps/worker/src/knowledge/knowledge-hybrid.ts` (fusão atual)
- `apps/worker/src/knowledge/chunker.ts` (indexação)
- `packages/use-cases/src/knowledge/*` (busca)
- `packages/infra/src/embeddings/*` (embeddings + futura interface de reranker)
- `packages/infra/src/db/schema/knowledge*` (FTS5 virtual table para BM25)
- Referência LionClaw: `/Users/juniorfaria/projects/lionclawv1.0/electron/main/knowledge-engine.ts` (RRF + Cohere + HyDE)

**O que fazer.**
1. **BM25 via FTS5**: criar virtual table `FTS5` sobre `knowledgeChunks.content`; query BM25 substitui o `LIKE %query%` atual (relevância por termo, não substring).
2. **Reciprocal Rank Fusion**: combinar ranking BM25 + ranking vector (cosine/vec0 do P3-5) via RRF (`score = Σ 1/(k + rank_i)`, `k≈60`). Implementação em `knowledge-hybrid.ts`.
3. **Rerank opcional** (feature-flagged): interface `Reranker` no domain; adapter Cohere (se `COHERE_API_KEY` no vault) ou cross-encoder local. Aplicar top-N (ex.: top-20 → rerank → top-5).
4. **HyDE opcional** (feature-flagged): gerar resposta hipotética via LLM a partir da query, embeddá-la, usar para retrieval — melhora queries semânticas sem keyword match.
5. Métrica: instrumentar `precision@5` e `recall@k` em log (sem virar produto — alinhado à justificativa do ADR-0032 de manter benchmark como dev-tool).

**Aceitação.** Busca híbrida com BM25 (FTS5) + RRF (vector+BM25); rerank e HyDE feature-flagged (off por default, on via config/vault key); teste demonstra ranking superior ao keyword-only em dataset amostral (precision@5 melhora); sem regressão quando flags off.

**Esforço:** L.

---

## Fase FE — Refactor de Frontend (🟡 P2 / 🟠 onde toca contrato)

> **Estado atual (verificado).** Base sólida: 36 primitivos shadcn (`apps/web/components/ui/`), design tokens oklch light/dark (`packages/design-tokens/src/` — colors/spacing/typography/tokens.css), 25 dirs de feature, a11y axe. **Lacunas:** só 1 Storybook story (`button.stories.tsx`), navegação cobre ~18/28 páginas, rotas Settings 404, placeholders (permissions), report `<pre>`, sem SidebarTrigger mobile, contratos BE↔FE quebrados. Este refactor transforma "base boa, borda frágil" em produto coeso. Itens P0/P2 acima são pré-requisitos — aqui ficam as demandas transversais.

### FE-1 — Layout moderno, minimalista, impactante, usável

**Descrição.** Garantir consistência visual e impacto sem ruído em todas as 25 áreas.

**O que fazer.**
1. Definir **app shell canônico**: `app/(app)/layout.tsx` + `sidebar.tsx` + `topbar.tsx` como única moldura; toda página renderiza dentro dela com mesmo padding/max-width/spacing de tokens.
2. **Hierarquia visual**: page header padrão (título + descrição + ações à direita) como componente reutilizável (`PageHeader`); aplicar em todas as páginas.
3. **Estados vazios/loading/erro** padronizados: `EmptyState`, `Skeleton` (já existe primitivo), `ErrorState` — usados em todas as listas (knowledge, agents, tasks, logs, etc.).
4. **Densidade e respiro**: aplicar escala de spacing dos tokens; remover paddings ad-hoc. Tipografia via `typography.ts` (sem `text-[..]` arbitrário).
5. **Microinterações sóbrias**: transições de 150-200ms em hover/focus; sem animação gratuita.

**Aceitação.** Toda página usa o shell + `PageHeader` + estados padronizados; zero valor de cor/spacing/tipo hardcoded (lint custom ou revisão); navegação entre páginas mantém moldura estável.

**Esforço:** L.

---

### FE-2 — Layout e componentes padronizados (design system)

**Descrição.** 36 primitivos existem, mas só 1 tem story e há risco de uso divergente entre features.

**O que fazer.**
1. **Storybook para todos os primitivos** (`ui/*.tsx`) + variantes/estados — hoje só `button`. Vira fonte de verdade do design system.
2. **Catálogo de componentes compostos** recorrentes (PageHeader, EmptyState, DataTable, FormField wrappers, ConfirmDialog, FilterBar) em `components/common/` — reusados, não recriados por feature.
3. **Tokens como única fonte**: garantir que cores/spacing/tipografia vêm de `packages/design-tokens`; mapear ao `@theme inline` Tailwind v4. Proibir hex/rgb cru.
4. **Lint de consistência**: regra para barrar classes arbitrárias de cor/spacing fora dos tokens; `max-lines` já enforce 300.
5. **Variantes via `cva`** consistentes (size/variant) em todos os primitivos.

**Aceitação.** Storybook cobre 36 primitivos + compostos; grep não acha hex hardcoded em `components/`; cada feature usa primitivos/compostos do catálogo (sem reimplementar botão/tabela).

**Esforço:** L.

---

### FE-3 — Frontend reflete TODAS as funcionalidades

**Descrição.** Hoje faltam UIs: permissions (placeholder), config de voz (ausente), pricing (ausente), dreaming (backend sem UI), seed agents (não populados → tela vazia), audit filtros. Páginas sem entrada de navegação.

**O que fazer.**
1. Implementar/concluir telas: **P2-1** permissions CRUD, **P2-2** config voz, **P2-3** pricing, **P2-6** audit filtros (já no plano) + **Dreaming UI** (visualizar limpeza/consolidação de MEMORY.md sobre `memory/dreaming/` existente).
2. Garantir que cada funcionalidade do backend (rotas em `app/api/**` + worker) tem ponto de entrada na UI.
3. **Mapa de cobertura**: planilha rota/feature → tela. Toda rota viva precisa de UI; toda UI precisa de rota viva (sem botão morto).

**Aceitação.** Mapa rota↔tela 100% preenchido; nenhuma funcionalidade só acessível por URL; nenhuma tela placeholder em produção.

**Esforço:** L.

---

### FE-4 — Integração BE↔FE funcional e correta (endpoints + contratos)

**Descrição.** Achados sistêmicos: shadow schemas, usage 3-shapes (P0-4), login schema≠handler (P0-6), SSE `ask_question` morto (P0-3), `/logs/stream` sem auth (P0-7). Frontend confia em shapes não validados.

**O que fazer.**
1. **Tipos compartilhados**: todo fetch/mutation do frontend importa o tipo/`Schema` de `@wolfkrow/shared-types` (depende de **P1-1**). Sem interface TS solta duplicando contrato.
2. **Camada de client tipada**: centralizar chamadas em `apps/web/lib/` com `Schema.parse(response)` no client (falha cedo se BE divergir).
3. **SSE/stream**: parser com `try/catch` por linha (não quebra stream em frame malformado — `sse.ts`, `chat-stream.ts`); tipos de evento do schema compartilhado.
4. **Auditar cada endpoint**: método/path/headers/cookie corretos; proxies web repassam sessão; erros → estados de UI (não tela branca).
5. Eliminar handlers/eventos mortos (P0-3) ou implementá-los end-to-end.

**Aceitação.** Nenhum shape de API definido só no frontend; `parse()` nas respostas; SSE resiliente a linha inválida; teste de contrato por endpoint crítico (auth, chat, usage, knowledge, vault).

**Esforço:** L.

---

### FE-5 — Layout bem distribuído e otimizado (performance + responsivo)

**Descrição.** Garantir distribuição espacial e performance de render.

**O que fazer.**
1. **Responsivo real**: SidebarTrigger no topbar (**P2-5**); breakpoints validados (mobile/tablet/desktop); tabelas com scroll/stack em telas pequenas.
2. **Code splitting**: lazy load de pesados (graph D3, terminal xterm, design studio iframe, charts) — confirmar `dynamic()` onde aplicável.
3. **Render**: memoizar listas grandes; evitar re-render por objeto inline em props; virtualizar listas longas (logs, knowledge chunks, audit).
4. **Core Web Vitals**: medir CLS/LCP; reservar espaço (skeletons) para evitar layout shift.
5. **Bundle**: revisar imports (tree-shaking de ícones/charts).

**Aceitação.** Mobile/tablet/desktop sem overflow/quebra; componentes pesados lazy; sem warnings de re-render evidentes; CLS baixo (skeletons).

**Esforço:** M-L.

---

### FE-6 — Melhores práticas UI/UX

**Descrição.** Boa base (axe, aria-labels) mas falta keyboard E2E, feedback consistente, prevenção de erro.

**O que fazer.**
1. **Acessibilidade**: navegação por teclado completa (focus rings, tab order, atalhos), `aria-*` em todos os interativos, foco gerenciado em dialogs; E2E de teclado (hoje só axe scan).
2. **Feedback**: toasts (`sonner` existe) para sucesso/erro de toda mutation; loading nos botões de submit; optimistic UI onde fizer sentido.
3. **Prevenção de erro**: validação inline de forms (Zod + react-hook-form), confirmações destrutivas (`ConfirmDialog`), disabled states claros.
4. **Consistência de interação**: mesmos padrões para criar/editar/deletar em todas as features.
5. **Copy**: textos claros, sem jargão; estados vazios com call-to-action.

**Aceitação.** E2E de teclado passando; toda mutation dá feedback visível; forms validam inline; ações destrutivas confirmam.

**Esforço:** M-L.

---

### FE-7 — Frontend sem ambiguidade

**Descrição.** Navegação dupla em Settings (cards vs tabs com rotas 404 — **P0-5**); pontos de entrada inconsistentes; possível duplicação de telas.

**O que fazer.**
1. **Uma fonte de navegação**: resolver P0-5 (remover tabs mortas, manter um padrão). Sidebar = mapa único do app.
2. **Sem rotas/botões mortos**: todo link leva a algo; toda página é alcançável por nav (não só URL).
3. **Nomenclatura consistente**: mesmo termo para mesma coisa em label de nav, título de página e doc (ex.: "MCP Servers" vs "MCP").
4. **Estado ativo**: item de nav reflete rota atual sem ambiguidade.
5. **Breadcrumb/contexto** onde houver hierarquia (settings, pipeline phases).

**Aceitação.** Zero 404 navegando; zero duplicação de entrada para a mesma tela; nomenclatura uniforme nav↔título↔doc; item ativo correto.

**Esforço:** S-M.

---

### Pré-requisitos e dependências do refactor FE

| FE-item | Depende de |
|---|---|
| FE-3 | P2-1, P2-2, P2-3, P2-6 (telas faltantes) |
| FE-4 | **P1-1** (Zod boundaries), P0-3, P0-4, P0-6, P0-7 |
| FE-5 | P2-5 (SidebarTrigger) |
| FE-7 | **P0-5** (rotas Settings) |

---

## Sequência recomendada

```
Sprint 1 (gates):  P0-1 · P0-2 · P0-4 · P0-5 · P0-6 · P0-7 · (decisão P0-3)
Sprint 2 (contratos/qualidade): P1-1 → P1-2/P1-3 · P1-4 · P1-5 · P1-9
Sprint 3 (bugs runtime): P1-6 · P1-7 · P1-8
Sprint 4 (telas faltantes + decisões escopo): P2-1..P2-8 · P2-9 (decisão mgraph)
Sprint 5 (refactor FE transversal): FE-1 · FE-2 · FE-4 (pós P1-1) · FE-7 (pós P0-5)
Sprint 6 (FE polish): FE-3 · FE-5 · FE-6
Sprint 7 (governança): P3-1..P3-6 (P3-6 = RAG rerank, pós P3-5 vec0)
```

> FE-4 e FE-7 dependem de gates (P1-1 Zod, P0-5 rotas) — não iniciar antes. FE-3 consome as telas dos Sprints 4.

**Definition of Done global:** `pnpm test` + `typecheck` + `lint` verdes; thresholds reais (worker ≥85%, web ≥70%); zero rota 404; Zod ativo em todos boundaries; seed agents populados em runtime; SSRF fechado; docs reconciliados; release re-tagueada.
