# Wolfkrow MVP Final - Auditoria e Plano de Implementacao

Data da auditoria: 2026-06-27

Escopo analisado:

- Projeto Wolfkrow: `/Users/juniorfaria/projects/wolfkrow-tool`
- Projeto Lionclaw: `/Users/juniorfaria/projects/lionclawv1.0`
- Specs: `docs/specs`
- ADRs: `docs/adr`
- Documentos-base: `docs/ARCHITECTURE.md`, `docs/FEATURE_MATRIX.md`, `docs/MIGRATION_FROM_LIONCLAW.md`, `docs/PRD.md`

Observacao operacional: a auditoria tentou usar sub-agents conforme solicitado, mas as seis execucoes foram bloqueadas por limite de uso da ferramenta de sub-agentes. A analise abaixo foi concluida manualmente com leitura direta do repositorio, comparacao com Lionclaw, execucao de comandos de qualidade e consolidacao das evidencias.

## 1. Resumo executivo

O Wolfkrow ja possui uma base ampla em Next.js, worker Fastify, pacotes de dominio/use-cases/infra, contratos Zod, testes unitarios e varias telas funcionais. Porem, a versao atual ainda nao atende ao criterio de MVP definido nesta auditoria: "todas as funcionalidades do Lionclaw identicas ou melhores".

Os principais bloqueios para considerar o MVP final pronto sao:

1. `pnpm typecheck` falha no Web por erro de tipo em `apps/web/app/api/mcp-servers/[id]/route.ts`.
2. `pnpm lint` aborta por estouro de memoria do Node ao executar ESLint em JSON.
3. A autenticacao tem token de 30 dias, mas o app ainda bloqueia/desloga em 5 minutos de idle ou ao ocultar a aba, contrariando a regra de bloquear apenas apos expiracao do token.
4. O chat com provider customizado/built-in falha quando a chave esta salva em account configuravel, porque o orquestrador usa apenas o mapa fixo do keychain.
5. Pipeline executa fases AI sempre com Anthropic, ignorando provider/model selecionado e overrides de `baseUrl`, `apiKeyAccount` e modelo.
6. MCPs built-in podem nao aparecer na UI porque a tela lista apenas registros persistidos, apesar de existir catalogo estatico.
7. Harness/Pipeline ainda nao entregam a experiencia operacional do Lionclaw: acompanhamento rico, timeline, streams persistentes, interacao HITL durante execucao, pausa/abort confiavel e visualizacao clara de rounds/fases.
8. O modelo de acesso "sem bloqueios por usuario" esta inconsistente: parte do Web usa workspace compartilhado, mas worker/use-cases ainda filtram por `userId` ou usam fallbacks como `anonymous/default`.
9. OpenDesign existe, mas rotas de lifecycle nao aplicam autenticacao/authorization, e as fases `design`/`design_lock` nao aparecem corretamente no fluxo visual do Pipeline.
10. Ha funcionalidades documentadas como v1.1/descoped que, pelo criterio deste MVP, precisam voltar ao escopo: ask-user dialog real, Excalidraw inline no chat, Harness AI automatico completo, spec build/validate/enrich seed agents e paridade de pipeline.

Conclusao: o Wolfkrow esta em estado avancado, mas ainda e um "MVP incompleto para paridade Lionclaw". O plano abaixo organiza a implementacao final em fases de correcao, paridade e validacao rigorosa.

## 2. Estado dos comandos de qualidade

Comandos executados durante a auditoria:

- `pnpm test`: passou, mas com cache total do Turborepo. Resultado observado: 25 tasks bem-sucedidas, 25 totais, 25 cached, tempo aproximado de 155ms. Isso nao comprova a saude do codigo alterado sem uma execucao forcada.
- `pnpm typecheck`: falhou em `@wolfkrow/web`.
- `pnpm lint`: falhou por `SIGABRT`/out of memory ao rodar `eslint -f json .`.

Falha de typecheck identificada:

- Arquivo: `apps/web/app/api/mcp-servers/[id]/route.ts`
- Erro: `healthCheck` esta sendo tratado como `Record<string, unknown> | undefined`, mas o tipo atual espera `string | undefined` em uma chamada de update. A linha auditada usa `optionalField(body.healthCheck as Record<string, unknown> | undefined, current.healthCheck)`.
- Impacto: o projeto nao passa gate minimo de qualidade TypeScript.

Falha de lint:

- Log: `~/Library/Application Support/rtk/tee/1782564279_lint.log`
- Causa observada: `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- Impacto: CI/lint nao e confiavel; pode esconder problemas reais de estilo, complexidade e bugs.

## 3. Achados por severidade

### 3.1 Bloqueadores

#### B1 - Typecheck quebrado em MCP update

Evidencia:

- `apps/web/app/api/mcp-servers/[id]/route.ts`
- TypeScript falha ao compilar por incompatibilidade de tipo em `healthCheck`.

Impacto:

- Bloqueia build/CI.
- Indica divergencia de contrato entre shared-types, route handler e persistencia MCP.

Implementacao requerida:

- Reconciliar o tipo de `healthCheck` em `@wolfkrow/shared-types`, dominio/infra e routes.
- Usar um tipo unico para `McpHealthCheck` em todos os pontos.
- Adicionar teste de update parcial validando `healthCheck` existente, substituido e removido.

#### B2 - Auto-lock viola a regra de token de 30 dias

Evidencia:

- `packages/infra/src/auth/jwt.ts` define expiracao `30d`.
- `apps/web/app/api/auth/login/route.ts` define cookie `maxAge: 60 * 60 * 24 * 30`.
- `apps/web/hooks/use-auto-lock.ts` define `IDLE_MS = 5 * 60 * 1000`, chama logout e redireciona para `/unlock` em idle e tambem em `document.hidden`.
- `apps/web/app/(app)/layout.tsx` monta `AutoLock`.

Impacto:

- O app bloqueia antes da expiracao do token.
- Contraria requisito explicito: "bloquear o app apenas apos a expiracao do token (30 dias)".

Implementacao requerida:

- Remover logout/lock por idle e por tab hidden.
- Tratar `/unlock` apenas quando token/cookie estiver ausente ou expirado.
- Preservar lockout de senha apenas no fluxo de login/unlock, nao por inatividade.
- Adicionar testes unitarios do hook/middleware e e2e de sessao persistente.

#### B3 - Chat agent falha por resolucao incorreta de API key

Evidencia:

- Erro reportado: `Missing API key in keychain: wolfkrow/zai-api-key`.
- `apps/worker/src/lib/keychain.ts` usa `ACCOUNT_MAP` fixo por provider.
- `apps/worker/src/orchestrator.ts` chama `getProviderApiKey(provider)` e depois `factory.create(providerName, apiKey)`.
- `apps/worker/src/agent-factory.ts` ja tem caminho mais correto para Harness: resolve `ProviderConfig`, le `cfg.apiKeyAccount` e usa `createFromConfig(cfg, apiKey)`.

Impacto:

- Provider salvo/editado pela UI pode nao ser usado no chat.
- Custom provider, override de provider built-in e chaves em accounts customizadas quebram.
- O erro do chat agent com Zai e reproduzivel pelo desenho atual.

Implementacao requerida:

- Criar `ProviderResolverService` unico no worker para Chat, Harness, Pipeline, Enrich e Channels.
- Resolver provider por `ProviderConfig` mergeado entre built-ins e custom/overrides.
- Buscar chave primeiro por `cfg.apiKeyAccount`, depois fallback legado `getProviderApiKey(cfg.id)`.
- Instanciar provider com `aiFactory.createFromConfig(cfg, apiKey)` para respeitar `baseUrl`, `headers`, `models` e compatibilidade Anthropic/OpenAI.
- Cobrir Zai/GLM, Kimi/Moonshot, MiniMax e Qwen via `claude-compat` com overrides.

#### B4 - Pipeline ignora provider selecionado e forca Anthropic

Evidencia:

- `apps/worker/src/routes/pipeline.ts` usa `getAnthropicApiKey()` e `aiFactory.create('anthropic', apiKey)` nas fases AI e SSE.
- `apps/worker/src/routes/pipeline-design.ts` faz o mesmo no chat de fase.
- `apps/worker/src/routes/pipeline-design.ts` tambem hardcodeia `coderModel: 'claude-sonnet-4-6'` e `plannerModel: 'claude-opus-4-8'` ao delegar implementacao para Harness.

Impacto:

- Selecionar GLM/Zai, Kimi/Moonshot, MiniMax ou Qwen nao garante execucao pelo SDK/provider correto.
- Overrides de provider criados na UI nao sao respeitados.
- Tokens/custos/modelos exibidos podem nao corresponder ao que foi executado.

Implementacao requerida:

- PipelineProject deve armazenar `providerId`, `plannerModel`, `coderModel`, `reviewModel` quando aplicavel.
- `RunPhaseUseCase`, `ContinuePipelineConversationUseCase` e `ImplementViaHarnessUseCase` devem receber provider resolvido pelo servico unico.
- Remover `getAnthropicApiKey()` das rotas de pipeline exceto como fallback explicito do provider Anthropic.
- Adicionar testes para cada provider claude-compatible e custom base URL.

#### B5 - MCPs built-in nao aparecem quando nao ha seed persistido

Evidencia:

- `apps/web/app/api/mcp-servers/catalog/route.ts` retorna catalogo built-in/planned.
- `apps/web/app/api/mcp-servers/route.ts` retorna apenas `repo.findAll(session.userId)`.
- `apps/web/components/mcp/mcp-servers-view.tsx` busca catalogo, depois busca registros persistidos e exibe somente `data.servers`.

Impacto:

- O usuario pode ver lista vazia mesmo existindo catalogo de MCPs.
- A tela nao reflete capacidades do produto nem permite habilitar built-ins se seed falhar.

Implementacao requerida:

- Materializar catalogo built-in como linhas virtuais quando nao houver registro persistido.
- Persistir somente quando usuario alterar estado/configuracao.
- Exibir planned como desabilitado/planejado, sem fingir disponibilidade.
- Adicionar health/status por MCP real.

### 3.2 Criticos

#### C1 - Escopo por usuario ainda bloqueia recursos

Evidencia:

- `apps/web/lib/auth.ts` implementa modo workspace compartilhado para Web.
- Worker routes/use-cases ainda usam `req.user.userId`, `findByUserId`, comparacao de ownership e fallbacks `anonymous/default`.
- Exemplos: `apps/worker/src/routes/chat-sessions.ts`, `apps/worker/src/routes/providers.ts`, `apps/worker/src/routes/harness.ts`, `apps/worker/src/routes/tasks.ts`, use-cases de pipeline list/delete.

Impacto:

- Usuarios diferentes podem nao ver cadastros/execucoes criados por outros.
- Contraria requisito: "todos usuarios devem ter acesso a todas funcionalidades e cadastros sem bloqueios, filtros ou travas".

Implementacao requerida:

- Definir modo oficial: workspace local compartilhado por padrao.
- Criar `WorkspaceContext` com `workspaceId = 'default'` e `actorUserId` apenas para auditoria.
- Migrar repositorios/use-cases de ownership por usuario para escopo por workspace.
- Remover filtros que impedem acesso entre usuarios no modo compartilhado.
- Manter `userId` apenas para createdBy/updatedBy/audit.

#### C2 - Pipeline projectPath nao e validado

Evidencia:

- Harness usa validacao de path em `apps/worker/src/lib/project-path.ts`.
- Pipeline create route aceita `projectPath` e salva diretamente.
- Dominio/use-case de Pipeline nao validam absoluto/existente/diretorio/allowlist.

Impacto:

- Execucoes podem apontar para path invalido ou inseguro.
- Erro "criar novo projeto" pode estar relacionado a contratos/path inconsistentes.

Implementacao requerida:

- Reusar `validateProjectPath` no Pipeline e no novo cadastro de Projetos.
- Validar path antes de persistir.
- Retornar mensagens de erro acionaveis para o frontend.
- Adicionar teste unitario e e2e de cadastro com path invalido/valido.

#### C3 - OpenDesign tem rotas privilegiadas sem hardening de auth

Evidencia:

- `apps/worker/src/routes/open-design.ts` registra start/stop/status/bootstrap/snapshot/lock.
- Comentario no arquivo reconhece que lifecycle e operacao privilegiada e que auth hardening esta pendente.

Impacto:

- Qualquer chamada que alcance o worker pode iniciar/parar sidecar e capturar artefatos.
- Incompatibilidade com padrao de seguranca do restante do app.

Implementacao requerida:

- Proteger todas as rotas com autenticacao do worker.
- Aplicar autorizacao de workspace e audit log.
- Validar `outputDir` com allowlist.
- Criar testes de 401/403/sucesso e teste de auditoria.

#### C4 - UI do Pipeline nao reflete fases design/design_lock

Evidencia:

- Dominio/rotas possuem `design` e `design_lock`.
- `apps/web/components/pipeline/pipeline-view.tsx` usa `STAGE_ORDER = ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation', 'completed']`.

Impacto:

- Integracao OpenDesign fica escondida/incompleta.
- Usuario nao entende quando a etapa visual deve ocorrer.

Implementacao requerida:

- Atualizar ordem visual para incluir `design` e `design_lock`.
- Exibir status do sidecar, link Studio, snapshot/lock e artefatos capturados.
- Integrar timeline com eventos dessas fases.

#### C5 - Funcionalidades descoped precisam voltar ao MVP

Evidencia:

- `docs/PRD.md` lista como v1.1: Harness AI automatico, spec build/validate/enrich seed agents, pipeline report, Excalidraw inline, artifact detection, pricing calculator, knowledge benchmark.
- `docs/FEATURE_MATRIX.md` lista descoped: Excalidraw inline, interactive ask-user dialog, filtros avancados de audit, harness AI automatico.

Impacto:

- A documentacao aceita um escopo menor que o requisito atual do MVP.
- Pelo criterio desta auditoria, qualquer funcionalidade existente no Lionclaw deve entrar no MVP final.

Implementacao requerida:

- Reclassificar no plano como MVP final tudo que e paridade Lionclaw.
- Atualizar PRD/Feature Matrix apos implementacao.

### 3.3 Maiores

#### M1 - Sidebar nao tem toda a ergonomia do Lionclaw

Evidencia:

- Lionclaw sidebar contem itens principais: Chat, SubAgents, Skills, MCP Servers, Scheduler, Canais, Conhecimento, Pipeline, Cerebro, Logs, Codeburn, Vault, Settings.
- Wolfkrow nav contem mais itens e nao aparenta duplicidade obvia, mas nao reproduz a lista dinamica de sessoes de chat, sessoes Telegram e resumo de pipeline ativo no sidebar.

Impacto:

- Navegacao perde contexto operacional que existia no Lionclaw.
- Telas existentes podem ficar escondidas ou com baixa prioridade.

Implementacao requerida:

- Revisar hierarquia do sidebar.
- Agrupar Harness/Pipeline em "Workflows" ou manter ambos com subitens claros.
- Adicionar secoes contextuais colapsaveis: sessoes de chat, canais/sessoes Telegram, execucoes ativas.
- Garantir que toda rota funcional tenha caminho de menu ou entrada contextual.

#### M2 - Tela de Agents nao segue ordem pedida

Evidencia:

- `apps/web/components/agents/agent-form-body.tsx` renderiza Name, System Prompt e depois tabs.
- `apps/web/components/agents/model-section.tsx` renderiza Model, Effort/MaxTurns, Runtime, Provider.

Impacto:

- Ordem exigida nao e atendida: nome, system prompt, effort, max turn, provider, model, runtime.
- Campos essenciais ficam escondidos em tabs, prejudicando cadastro rapido.

Implementacao requerida:

- Reordenar campos principais no corpo do formulario.
- Manter tabs apenas para tools, thinking avancado, skills e metadata.
- Garantir MarkdownEditor para system prompt e preview.

#### M3 - Skills e Providers precisam permitir edicao completa

Evidencia:

- Skill editor tem suporte a `readOnly`.
- Provider list/use-cases mesclam built-ins e custom, mas delete bloqueia built-ins e edit/override precisa garantir update do registro existente, nao criacao duplicada.

Impacto:

- Usuario pode nao conseguir editar skill/provider existente.
- Overrides podem duplicar registros ou confundir o provider real usado.

Implementacao requerida:

- Habilitar override editavel para qualquer skill/provider built-in.
- Preservar registro base e salvar override no workspace.
- UI deve mostrar origem: built-in, override, custom.
- Provider edit deve manter `id` estavel em edicao e fazer upsert.

#### M4 - Channels ainda sao parciais

Evidencia:

- Seeder de channels inclui placeholders para Telegram/Discord/Slack/Whatsapp.
- Requisito pede configuracao de channel com dados necessarios.

Impacto:

- Tela pode existir sem configuracao operacional completa.

Implementacao requerida:

- Implementar `ChannelConfig` por tipo, com schemas por provider.
- Telegram deve ser funcional e testado end-to-end.
- Canais nao implementados devem aparecer como "planejado" ou serem removidos do fluxo operacional.

#### M5 - Harness/Pipeline layout e execucao nao atingem paridade

Evidencia:

- Lionclaw Harness tem streams separados Coder/Evaluator, restore de logs, timer, sprint update, pause/abort.
- Wolfkrow tem paginas de run, mas com UX mais simples e DEBT de abort server-side.
- Pipeline Stream do Lionclaw mostra tool calls colapsaveis, transicao automatica, retry/abort e status rico.

Impacto:

- Usuario nao consegue acompanhar/interagir com execucoes no mesmo padrao do Lionclaw.
- Telas de Harness e Pipeline ficam confusas e desalinhadas com o produto.

Implementacao requerida:

- Criar console unificado de execucao com timeline, streams por agente/fase, eventos, tool calls, artefatos, chat HITL e controles.
- Persistir eventos e permitir reconexao/restore.
- Implementar abort/pause/resume reais no worker.

#### M6 - Falta cadastro central de Projetos

Evidencia:

- Harness e Pipeline possuem seus proprios projetos.
- Nao ha rota/menu central `/projects`.

Impacto:

- `projectPath` fica duplicado/inconsistente.
- Pipeline/Harness/OpenDesign nao compartilham o mesmo contexto de projeto.

Implementacao requerida:

- Criar dominio `Project` central com nome, descricao, rootPath, repo metadata, specPath opcional, tags, status.
- HarnessProject e PipelineProject devem referenciar Project.
- UI `/projects` deve permitir CRUD, validar path e iniciar workflow.

#### M7 - Testes atuais nao provam todos os contratos criticos

Evidencia:

- `pnpm test` passou apenas por cache.
- Typecheck e lint falharam.
- Lacunas nao cobertas: provider resolver real, workspace compartilhado, MCP catalog fallback, pipeline provider selection, OpenDesign auth, HITL.

Impacto:

- Alto risco de regressao e falsa confianca.

Implementacao requerida:

- Rodar testes forcados no plano final.
- Adicionar testes unitarios/integracao/e2e para fluxos criticos.
- Definir DoD que bloqueia merge sem typecheck/lint/test/build/e2e principais.

## 4. Matriz de paridade Lionclaw x Wolfkrow

| Area              | Lionclaw observado                                         | Wolfkrow atual                                                       | Status MVP final                    |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| Chat              | Sessoes, agentes, streaming, interacoes e contexto visual  | Chat existe, mas provider/keychain e ask-user real falham/incompleto | Precisa corrigir                    |
| Sidebar           | Menu principal + sessoes de chat/Telegram + contexto ativo | Menu amplo sem duplicidade obvia, mas menos contextual               | Melhorar                            |
| Agents/SubAgents  | Cadastro operacional com prompts/modelos                   | Tela existe, ordem e ergonomia precisam ajuste                       | Melhorar                            |
| Skills            | Gestao/edicao de skills                                    | Editor existe, mas read-only/override devem ser revisados            | Precisa validar/corrigir            |
| MCP Servers       | Catalogo funcional e visivel                               | UI pode ficar vazia sem seed persistido                              | Corrigir                            |
| Scheduler/Tasks   | Operacional                                                | Existe no Wolfkrow                                                   | Validar e2e                         |
| Channels/Telegram | Sessoes/canais integrados ao uso                           | Parcial e placeholders                                               | Corrigir                            |
| Knowledge         | Ingest/search                                              | Existe com melhorias parciais                                        | Validar                             |
| Harness           | Execucao acompanhavel com streams e controles              | Base existe, UX/execucao incompleta                                  | Corrigir                            |
| Pipeline          | Fluxo rico com streaming, tool calls, transicoes           | Base existe, hardcode Anthropic e UI incompleta                      | Corrigir                            |
| Memory/Cerebro    | Contexto/memoria                                           | Existe, algumas decisoes descoped                                    | Validar paridade real               |
| Logs              | Logs visiveis                                              | Existe                                                               | Validar filtros/export              |
| Codeburn/Terminal | Terminal                                                   | Existe como Terminal                                                 | Validar                             |
| Vault             | Segredos                                                   | Existe via keytar                                                    | Corrigir integracao provider        |
| Settings          | Configuracoes                                              | Existe                                                               | Reorganizar providers/channels/auth |
| OpenDesign        | Integracao esperada com pipeline/harness                   | Sidecar existe, integracao visual e auth incompletas                 | Corrigir                            |

## 5. Plano de implementacao do MVP final

### Fase 0 - Gate de qualidade e baseline

Objetivo: tornar o repositorio verificavel antes de mudancas funcionais grandes.

Arquivos-alvo principais:

- `apps/web/app/api/mcp-servers/[id]/route.ts`
- `packages/shared-types/src/**`
- `packages/domain/src/**`
- `packages/infra/src/**`
- `package.json`, `turbo.json`, configs ESLint se necessario

Implementacao:

1. Corrigir o erro de tipo de `healthCheck`.
2. Revisar schema compartilhado de MCP e garantir que create/update/list usam o mesmo tipo.
3. Investigar OOM do lint:
   - rodar lint por pacote;
   - identificar pacote/arquivo que explode memoria;
   - excluir diretorios gerados/vendor/build quando indevidos;
   - se necessario, ajustar script para `NODE_OPTIONS=--max-old-space-size=8192`, mas somente depois de remover escopos indevidos.
4. Rodar:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm turbo test --force`
   - `pnpm build`
5. Registrar baseline em documento curto ou secao de release.

Criterios de aceite:

- Typecheck passa sem erro.
- Lint passa sem OOM.
- Testes rodam sem cache e passam.
- Build passa.

### Fase 1 - Auth de 30 dias e workspace compartilhado

Objetivo: cumprir o requisito de sessao e remover bloqueios/filtros indevidos por usuario.

Arquivos-alvo principais:

- `apps/web/hooks/use-auto-lock.ts`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/middleware.ts`
- `apps/web/lib/auth.ts`
- `apps/worker/src/routes/**`
- `packages/use-cases/src/**`
- repositorios em `packages/infra/src/**`
- schemas/migrations Drizzle se `workspaceId` for introduzido

Implementacao:

1. Remover comportamento de logout por idle e por `visibilitychange`.
2. Manter token/cookie em 30 dias.
3. Alterar `/unlock` para ser acessado apenas quando token estiver ausente/expirado ou quando usuario fizer logout manual.
4. Criar `WorkspaceContext`:
   - `workspaceId`: por padrao `default`;
   - `actorUserId`: usuario autenticado para audit log;
   - `sharedWorkspace`: true por padrao.
5. Migrar use-cases e repositorios que listam por `userId` para listar por `workspaceId`.
6. Remover fallbacks `anonymous` e `default` em rotas autenticadas.
7. Manter audit log com `actorUserId`, sem filtrar recursos por usuario.

Criterios de aceite:

- Usuario A cria provider/skill/project; usuario B autenticado ve e edita o mesmo recurso.
- App nao bloqueia ao ficar idle por mais de 5 minutos.
- App nao bloqueia ao alternar aba.
- App solicita senha apenas apos expiracao real do token/cookie ou logout.

### Fase 2 - Provider resolver unico e SDK correto

Objetivo: garantir que Chat, Harness, Pipeline e demais fluxos executem o provider/model selecionado, incluindo Anthropic-compatible com overrides.

Arquivos-alvo principais:

- `apps/worker/src/lib/keychain.ts`
- `apps/worker/src/orchestrator.ts`
- `apps/worker/src/agent-factory.ts`
- `apps/worker/src/routes/pipeline.ts`
- `apps/worker/src/routes/pipeline-design.ts`
- `packages/infra/src/ai-providers/**`
- `packages/domain/src/providers/**`
- `packages/use-cases/src/providers/**`

Implementacao:

1. Criar servico `ProviderResolverService` no worker.
2. Entrada minima:
   - `providerId`;
   - `model`;
   - `workspaceId`;
   - `actorUserId`;
   - fallback permitido.
3. Saida:
   - `ProviderConfig` final;
   - API key resolvida;
   - `AIProvider` criado por `createFromConfig`;
   - metadata para audit/usage.
4. Resolver chaves:
   - primeiro `cfg.apiKeyAccount`;
   - fallback legado pelo mapa fixo;
   - erro deve informar provider, account esperado e acao sugerida, sem expor segredo.
5. Remover `factory.create(providerName, apiKey)` dos caminhos que precisam config.
6. Corrigir chat agent com Zai:
   - provider `zai` deve virar `claude-compat:zai` ou config equivalente;
   - base URL/modelos devem vir da config;
   - chave deve sair de `apiKeyAccount`.
7. Corrigir Pipeline:
   - armazenar provider/model por projeto/fase;
   - fases AI usam resolver;
   - fase implementation delegada ao Harness usa provider/model do projeto.
8. Corrigir Harness:
   - manter comportamento atual de `createFromConfig`, mas mover para servico comum.
9. Auditar stubs:
   - `packages/infra/src/ai-providers/lion.ts` nao pode retornar `stub:*` em fluxo MVP funcional, exceto se explicitamente marcado como provider de teste.

Criterios de aceite:

- Chat com Zai/GLM funciona usando chave salva no provider/vault.
- Kimi/Moonshot, MiniMax e Qwen executam pelo caminho Anthropic-compatible correto.
- Pipeline nao usa Anthropic quando outro provider foi selecionado.
- Overrides de base URL/API key/model list sao respeitados.
- Testes cobrem built-in, override e custom provider.

### Fase 3 - Cadastro central de Projetos

Objetivo: criar um cadastro unico de projetos para Harness, Pipeline, OpenDesign, Knowledge e Terminal.

Arquivos-alvo principais:

- `packages/domain/src/project*`
- `packages/shared-types/src/project*`
- `packages/use-cases/src/projects/**`
- `packages/infra/src/db/schema.ts`
- `apps/worker/src/routes/projects.ts`
- `apps/web/app/(app)/projects/page.tsx`
- `apps/web/components/projects/**`
- `apps/web/lib/nav.ts`

Implementacao:

1. Criar entidade `Project`:
   - `id`;
   - `workspaceId`;
   - `name`;
   - `description`;
   - `rootPath`;
   - `specPath`;
   - `defaultProviderId`;
   - `defaultPlannerModel`;
   - `defaultCoderModel`;
   - `tags`;
   - `status`;
   - `createdBy`;
   - timestamps.
2. Criar CRUD:
   - create;
   - list;
   - get;
   - update;
   - archive/delete seguro.
3. Validar `rootPath` e `specPath` com `validateProjectPath`.
4. Migrar HarnessProject/PipelineProject para referenciar `projectId`.
5. UI `/projects`:
   - lista compacta;
   - formulario polido;
   - acoes: abrir chat com contexto, iniciar Harness, iniciar Pipeline, abrir Design Studio, abrir Terminal no path.
6. Sidebar deve incluir Projects ou Workflows com Projects como entrada principal.

Criterios de aceite:

- Novo projeto com path valido salva.
- Path invalido retorna erro claro.
- Harness e Pipeline podem ser criados a partir do mesmo projeto.
- Execucoes usam o path do projeto sem campo duplicado/confuso.

### Fase 4 - MCP Manager funcional e visivel

Objetivo: garantir que MCPs sejam exibidos, editados e executados de modo previsivel.

Arquivos-alvo principais:

- `apps/web/app/api/mcp-servers/**`
- `apps/web/components/mcp/**`
- `apps/worker/src/routes/mcp.ts`
- `packages/infra/src/seed/built-in-mcps.ts`
- repositorio MCP em `packages/infra/src/**`

Implementacao:

1. List API deve retornar:
   - registros persistidos;
   - built-ins virtuais do catalogo quando ausentes;
   - planned como indisponivel.
2. UI deve exibir todos com source/status:
   - built-in;
   - override;
   - custom;
   - planned.
3. Ao editar built-in, criar override persistido.
4. Implementar health check real onde existir comando/binario.
5. Botao start/stop/restart deve chamar worker MCP manager e refletir estado.
6. Corrigir contratos `healthCheck`.

Criterios de aceite:

- Tela nunca fica vazia se catalogo built-in existir.
- Editar built-in nao duplica item visual.
- MCP indisponivel mostra motivo claro.
- Testes cobrem catalog fallback, override e health.

### Fase 5 - Configuracoes: Agents, Skills, Providers e Channels

Objetivo: polir cadastros e garantir edicao completa sem bloqueios indevidos.

Arquivos-alvo principais:

- `apps/web/components/agents/**`
- `apps/web/components/skills/**`
- `apps/web/components/settings/provider-config/**`
- `apps/web/components/channels/**`
- `apps/web/app/api/providers/**`
- `apps/web/app/api/channels/**`
- `apps/worker/src/routes/providers.ts`
- `packages/use-cases/src/providers/**`

Implementacao:

Agents:

1. Reordenar campos:
   - nome;
   - system prompt;
   - effort;
   - max turn;
   - provider;
   - model;
   - runtime.
2. Usar MarkdownEditor no system prompt.
3. Mostrar validacao inline e preview.
4. Mover campos avancados para secoes colapsaveis.

Skills:

1. Permitir edicao de qualquer skill existente.
2. Para built-in, salvar override editavel.
3. Usar MarkdownEditor para corpo/instrucoes.
4. Mostrar origem e diff contra built-in quando houver override.

Providers:

1. Editar qualquer provider por override.
2. `save` deve fazer upsert por `id`, nao criar duplicado.
3. Cadastro deve mostrar:
   - nome;
   - tipo de compatibilidade;
   - base URL;
   - API key account;
   - modelo padrao;
   - lista de modelos;
   - headers opcionais.
4. Validar conexao com chamada leve.

Channels:

1. Criar tela de configuracao por canal.
2. Telegram deve ter token, chat/session mapping, status e teste de envio.
3. Canais nao prontos devem ficar claramente marcados como planejados ou desabilitados.
4. Integrar channels com chat/orchestrator quando aplicavel.

Criterios de aceite:

- Formulario Agents segue ordem exigida.
- Skill built-in pode ser editada via override.
- Provider built-in pode ser editado sem duplicar.
- Channel Telegram salva, testa conexao e opera.

### Fase 6 - Harness/Pipeline: console unificado, timeline e HITL

Objetivo: entregar uma experiencia igual ou melhor que Lionclaw para execucoes.

Arquivos-alvo principais:

- `apps/web/components/harness/**`
- `apps/web/components/pipeline/**`
- `apps/web/components/workflows/**` novo
- `apps/web/app/(app)/harness/**`
- `apps/web/app/(app)/pipeline/**`
- `apps/worker/src/routes/harness.ts`
- `apps/worker/src/routes/pipeline.ts`
- `apps/worker/src/harness/**`
- `packages/domain/src/**run/event**`
- `packages/use-cases/src/harness/**`
- `packages/use-cases/src/pipeline/**`

Implementacao:

1. Criar modelo comum `WorkflowRun`/`RunEvent`:
   - run started/completed/failed;
   - phase/sprint started/completed;
   - agent message;
   - tool call/result;
   - artifact created;
   - human question;
   - human answer;
   - pause/resume/abort.
2. Persistir eventos para restore.
3. Implementar SSE/WebSocket com reconexao.
4. Criar console visual:
   - header com projeto, workflow, provider/model, status, tempo e custo;
   - timeline vertical por fase/sprint;
   - painel de stream por agente;
   - painel de artefatos;
   - chat HITL sempre disponivel durante execucao;
   - controles Run, Pause, Resume, Abort, Retry.
5. Harness:
   - Planner -> Coder -> Evaluator automatico;
   - rounds com metricas;
   - feedback do evaluator alimenta nova rodada;
   - logs Coder/Evaluator persistentes como no Lionclaw.
6. Pipeline:
   - fases discovery, spec_build, spec_validate, design, design_lock, approval, implementation, completed;
   - auto-transition configuravel;
   - retry por fase;
   - chat por fase sem perder historico;
   - implementation usa Harness quando configurado.
7. Menu:
   - avaliar unificacao em "Workflows" com tabs Harness e Pipeline;
   - manter URLs antigas redirecionando para nao quebrar navegacao.

Criterios de aceite:

- Ao executar Harness/Pipeline, a tela de acompanhamento abre automaticamente.
- Usuario ve timeline em tempo real.
- Usuario interage por chat HITL durante a execucao.
- Abort/pause/resume funcionam no servidor, nao apenas no client.
- Refresh da pagina restaura estado e logs.

### Fase 7 - OpenDesign integrado e seguro

Objetivo: tornar OpenDesign parte real do fluxo de design/pipeline.

Arquivos-alvo principais:

- `apps/worker/src/routes/open-design.ts`
- `apps/worker/src/routes/pipeline-design.ts`
- `apps/web/components/sidecar/**`
- `apps/web/components/pipeline/**`
- `vendor/open-design/**` somente se necessario

Implementacao:

1. Proteger start/stop/status/bootstrap/snapshot/lock com auth.
2. Adicionar audit log para lifecycle.
3. Exibir estado do sidecar no Pipeline e Design Studio.
4. Integrar fases `design` e `design_lock` no console/timeline.
5. Capturar artefatos com path validado.
6. Mostrar snapshot/lock no report final do Pipeline.
7. Tratar erros de engine offline com CTA claro para iniciar.

Criterios de aceite:

- OpenDesign nao executa sem sessao valida.
- Pipeline mostra e executa fases de design.
- Artefatos de design aparecem na timeline/report.

### Fase 8 - Chat com paridade Lionclaw

Objetivo: completar chat, agentes, perguntas interativas e artefatos.

Arquivos-alvo principais:

- `apps/web/components/chat/**`
- `apps/web/app/(app)/chat/**`
- `apps/worker/src/routes/chat.ts`
- `apps/worker/src/orchestrator.ts`
- `packages/use-cases/src/chat/**`
- `packages/shared-types/src/chat/**`

Implementacao:

1. Corrigir provider resolver conforme Fase 2.
2. Implementar evento real de ask-user:
   - worker emite pergunta estruturada;
   - frontend abre dialog;
   - resposta volta ao run/chat;
   - estado fica persistido.
3. Confirm dialog para acoes destrutivas deve ser round-trip real, nao apenas mock de UI.
4. Excalidraw inline:
   - detectar artefato;
   - renderizar embed inline seguro;
   - permitir abrir externo como acao secundaria.
5. Sidebar de chat:
   - sessoes recentes;
   - sessoes Telegram/canais quando aplicavel;
   - streaming ativo.
6. Voz/STT/TTS:
   - validar fluxo com providers configurados;
   - mensagens de erro acionaveis quando dependencia local faltar.

Criterios de aceite:

- Chat agent com Zai funciona.
- Ask-user interrompe e retoma corretamente.
- Excalidraw aparece inline.
- Sessoes aparecem e podem ser retomadas pelo sidebar.

### Fase 9 - Redesign visual e UX Next.js

Objetivo: polir layout para web responsiva, moderna, minimalista, funcional e impactante, inspirada no Lionclaw mas otimizada para Next.js.

Arquivos-alvo principais:

- `apps/web/components/layout/**`
- `apps/web/components/page-shell.tsx` ou equivalente
- `apps/web/app/(app)/**`
- `apps/web/components/ui/**`
- `packages/design-tokens/**`
- `apps/web/app/globals.css`

Diretrizes:

1. SaaS operacional: denso, claro, utilitario, moderno.
2. Evitar telas com cards aninhados e secoes inteiras como cards flutuantes.
3. Cards apenas para itens repetidos, modais e ferramentas realmente emolduradas.
4. Header/content/footer devem ter hierarquia previsivel:
   - sidebar fixa/colapsavel;
   - topbar com contexto e acoes;
   - conteudo com largura responsiva;
   - footer/status bar apenas quando agregar estado operacional.
5. Componentes devem usar icons lucide em botoes.
6. Formularios devem ter ordem logica, validacao inline e labels claros.
7. Harness/Pipeline devem priorizar timeline, stream e HITL.
8. Responsivo:
   - desktop: layout multi-painel;
   - tablet/mobile: tabs ou drawers, sem overflow horizontal.
9. Acessibilidade:
   - foco visivel;
   - contraste;
   - labels;
   - navegacao por teclado.
10. Sem ambiguidade:

- cada botao deve indicar acao;
- estados loading/error/empty devem ser especificos e acionaveis.

Criterios de aceite:

- Todas as telas principais seguem PageShell padronizado.
- Sidebar nao tem duplicidades e todas as telas funcionais sao acessiveis.
- Harness/Pipeline nao parecem telas separadas do design system.
- Screenshots desktop/mobile nao apresentam sobreposicao ou texto cortado.

### Fase 10 - Documentacao, migracao e matriz

Objetivo: alinhar docs ao produto real apos implementacao.

Arquivos-alvo principais:

- `docs/PRD.md`
- `docs/FEATURE_MATRIX.md`
- `docs/MIGRATION_FROM_LIONCLAW.md`
- `docs/ARCHITECTURE.md`
- `docs/specs/**`
- `docs/adr/**`

Implementacao:

1. Atualizar PRD removendo do pos-MVP tudo que virou requisito do MVP final.
2. Atualizar Feature Matrix com status verificado por teste/manual.
3. Atualizar Migration com:
   - mapeamento Lionclaw -> Wolfkrow;
   - dados migrados;
   - limitacoes removidas;
   - passos de validacao.
4. Criar ADR se a decisao de workspace compartilhado substituir ownership por usuario.
5. Criar ADR se Harness/Pipeline forem unificados sob Workflows.

Criterios de aceite:

- Docs nao contradizem o criterio "paridade Lionclaw no MVP".
- Cada item da matriz tem evidencia de teste ou justificativa objetiva.

## 6. Auditoria final rigorosa obrigatoria

Esta auditoria deve ser executada ao final da implementacao, antes de considerar o MVP final aprovado.

### 6.1 Auditoria de requisitos

Checklist:

- Toda funcionalidade do Lionclaw tem equivalente no Wolfkrow.
- Toda funcionalidade marcada como implementada e acessivel via menu ou entrada contextual.
- Nenhuma tela funcional fica sem rota.
- Nenhum item duplicado no sidebar.
- Nenhuma funcionalidade/cadastro e bloqueado por usuario no modo workspace compartilhado.
- Token expira em 30 dias e app so pede senha apos expiracao/logout.
- Agents, Skills, MCP, Providers, Channels e Projects permitem CRUD/override esperado.
- Harness e Pipeline abrem tela de acompanhamento automaticamente.
- Chat HITL funciona em Chat, Harness e Pipeline.
- OpenDesign funciona integrado ao Pipeline.

Evidencias esperadas:

- Matriz de paridade atualizada.
- Screenshots desktop/mobile das telas principais.
- Log dos comandos de qualidade.
- Lista de fluxos manuais executados.

### 6.2 Auditoria tecnica

Comandos obrigatorios:

```bash
pnpm typecheck
pnpm lint
pnpm turbo test --force
pnpm test:e2e
pnpm build
```

Comandos adicionais recomendados:

```bash
pnpm format:check
pnpm test:cov
```

Regras de aceite:

- Zero falha de typecheck.
- Zero falha de lint.
- Testes unitarios sem cache passam.
- Testes e2e cobrem fluxos criticos.
- Build passa.
- Cobertura nao deve cair nos pacotes alterados.

### 6.3 Auditoria de arquitetura e clean code

Checklist:

- Shared-types continuam sendo fonte de verdade dos contratos.
- Use-cases nao importam detalhes de framework.
- Routes fazem parsing/auth/transporte, nao regra de negocio pesada.
- Infra implementa portas, nao decide regra de produto.
- Sem duplicacao de provider resolution.
- Sem `anonymous/default` em rotas autenticadas.
- Sem stubs em fluxo produtivo.
- Sem TODO/DEBT novo sem issue/plano.
- Funcoes grandes foram quebradas por responsabilidade real.
- SOLID/DRY/YAGNI aplicados sem criar abstracao artificial.

Busca obrigatoria:

```bash
rg "TODO|FIXME|DEBT|stub|placeholder|anonymous|default user|hardcoded|claude-opus|claude-sonnet|getAnthropicApiKey" apps packages docs
```

Aceite:

- Todo resultado e removido, justificado ou documentado com issue e nao afeta MVP.

### 6.4 Auditoria frontend/UI/UX

Fluxos manuais obrigatorios:

1. Login e permanencia de sessao por navegacao/idle.
2. Sidebar em desktop, tablet e mobile.
3. Criar projeto.
4. Criar/editar agent.
5. Criar/editar skill built-in via override.
6. Criar/editar provider built-in via override.
7. Configurar Zai/GLM ou outro claude-compatible e enviar chat.
8. Ver lista MCP com built-ins visiveis.
9. Configurar canal Telegram.
10. Executar Harness e acompanhar timeline.
11. Executar Pipeline com design/design_lock e implementation.
12. Interagir via HITL durante execucao.
13. Abrir OpenDesign pelo Pipeline e capturar artefato.
14. Ver report final.

Validacoes visuais:

- Sem texto cortado.
- Sem overlap.
- Sem cards dentro de cards.
- Estados empty/loading/error claros.
- Componentes padronizados.
- Layout responsivo sem scroll horizontal indevido.
- Contraste e foco adequados.

### 6.5 Auditoria backend/integracao

Testes obrigatorios:

- ProviderResolver:
  - Anthropic;
  - OpenAI;
  - OpenRouter;
  - Zai/GLM;
  - Moonshot/Kimi;
  - MiniMax;
  - Qwen;
  - custom base URL.
- Vault/keychain:
  - chave ausente;
  - chave em `apiKeyAccount`;
  - fallback legado;
  - erro sem vazamento de segredo.
- Workspace compartilhado:
  - usuario A cria;
  - usuario B lista/edita/executa.
- Project path:
  - path inexistente;
  - path arquivo;
  - path relativo;
  - path fora de allowlist;
  - path valido.
- OpenDesign:
  - 401 sem auth;
  - start/stop/status;
  - bootstrap/snapshot/lock;
  - erro de engine offline.
- Harness/Pipeline:
  - start;
  - stream;
  - pause;
  - resume;
  - abort;
  - retry;
  - restore apos refresh.

### 6.6 Auditoria de seguranca

Checklist:

- Todas as rotas worker exigem auth quando manipulam estado.
- Segredos nunca retornam para o frontend.
- API keys aparecem mascaradas.
- `projectPath` e `outputDir` sao validados.
- Tool calls destrutivas exigem permissao/confirmacao quando aplicavel.
- Audit log registra:
  - provider usado;
  - actor;
  - workspace;
  - tool calls;
  - alteracoes de cadastro;
  - start/stop de OpenDesign/MCP.

### 6.7 Auditoria de performance

Checklist:

- Listagens usam paginacao ou filtros quando crescerem.
- SSE/WebSocket nao vaza listeners.
- Timeline virtualiza eventos longos se necessario.
- Knowledge search nao trava UI.
- Lint/CI rodam em tempo aceitavel.

## 7. Ordem recomendada de execucao

1. Fase 0: corrigir gates de qualidade.
2. Fase 1: auth/workspace compartilhado.
3. Fase 2: provider resolver e SDK correto.
4. Fase 3: projetos.
5. Fase 4: MCP.
6. Fase 5: cadastros/configuracoes.
7. Fase 6: Harness/Pipeline e HITL.
8. Fase 7: OpenDesign.
9. Fase 8: Chat parity.
10. Fase 9: redesign visual.
11. Fase 10: documentacao.
12. Auditoria final completa.

Essa ordem reduz risco porque primeiro estabiliza compilacao/testes, depois corrige contratos transversais de auth/provider/project, e so entao entra nas telas e fluxos mais complexos.

## 8. Definicao de pronto do MVP final

O MVP final so deve ser considerado pronto quando todos os itens abaixo forem verdadeiros:

- Todas as funcionalidades do Lionclaw existem no Wolfkrow, identicas ou melhores.
- Todas as funcionalidades sao acessiveis por UI clara e responsiva.
- Chat, Harness, Pipeline e OpenDesign funcionam integrados.
- SDK/provider selecionado e o SDK/provider executado sao o mesmo.
- Nenhuma funcionalidade/cadastro e filtrado por usuario no modo local compartilhado.
- Token tem validade efetiva de 30 dias e nao ha bloqueio por idle/tab hidden.
- MCPs aparecem e podem ser gerenciados.
- Projetos existem como cadastro central.
- Testes unitarios, integracao, e2e, typecheck, lint e build passam.
- Nao ha stubs/placeholders em fluxo produtivo.
- Documentacao e Feature Matrix refletem o estado real implementado.
