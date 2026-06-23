# Wolfkrow Tool — Product Requirements Document (PRD)

> Versão: 1.0 (Draft)
> Data: 2026-06-20
> Status: Em planejamento para implementação
> Origem: Refactor do LionClaw v3.0

---

## 1. Visão

### 1.1 Problema

Usuários técnicos (desenvolvedores, fundadores, pesquisadores, power users) precisam de um **assistente pessoal de IA que roda 100% localmente**, com:

1. Acesso direto ao terminal, filesystem e internet (não apenas chat)
2. Memória persistente entre sessões (compaction, embeddings, semantic search)
3. Capacidade de executar tarefas complexas multi-stage (Harness, Pipeline)
4. Integração com serviços externos via MCP (Google, Telegram, YouTube, etc)
5. Privacidade total — nenhum dado sai da máquina sem permissão explícita
6. Customização profunda — agents, skills, prompts, regras

Chatbots web genéricos (ChatGPT, Claude.ai, Gemini) **não resolvem** isso porque:
- Não têm acesso ao terminal/filesystem
- Não persistem memória estruturada
- Não permitem automação complexa (cron, pipelines)
- Não integram com ecossistema local (MCPs)
- Dados ficam em cloud (privacidade)

### 1.2 Usuário Principal

**Persona 1: Desenvolvedor Solo / Founder Técnico**
- Stack: TypeScript, React, Node, Python
- Trabalha em múltiplos projetos simultaneamente
- Quer automatizar tarefas repetitivas (code review, test generation, deploy)
- Valoriza privacidade e controle

**Persona 2: Researcher / Data Scientist**
- Processa documentos (PDFs, papers, datasets)
- Precisa de RAG local sobre conhecimento proprietário
- Roda experiments em background
- Quer query em linguagem natural sobre seus dados

**Persona 3: Power User / Knowledge Worker**
- Gerencia múltiplas contas (email, calendar, tasks)
- Quer inbox zero automático
- Usa Telegram como primary chat
- Quer daily briefings customizados

### 1.3 Proposta de Valor

> **"Seu segundo cérebro, self-hosted, com superpoderes de IA."**

Wolfkrow Tool é o único assistente que combina:
- ✅ Acesso local a terminal/filesystem
- ✅ Memória persistente estruturada
- ✅ Multi-agent orchestration (Harness, Pipeline)
- ✅ 19+ integrações via MCP
- ✅ Voice conversation em tempo real
- ✅ 100% privado (single-machine)

### 1.4 Pitch (2-3 frases)

> Wolfkrow Tool é um app desktop e PWA que roda um assistente pessoal de IA self-hosted, single-user, com acesso direto ao seu terminal, filesystem e memória persistente. Diferente de chatbots web, ele executa tarefas complexas multi-stage (build apps completos, review PRs, gerenciar inbox), mantém contexto entre sessões, e integra com seus serviços via MCP — tudo sem nunca enviar dados para cloud.

---

## 2. Funcionalidades

### 2.1 Core Features (MVP — Release v1.0)

#### 2.1.1 Chat Multi-SDK Conversacional

**Descrição**: Chat principal com 4 motores de IA selecionáveis (Claude Agent SDK, Claude-compat, Codex SDK, Lion-SDK próprio).

**User Stories**:
- Como dev, quero escolher qual provider de IA usar para cada conversa (Anthropic direto vs OpenAI Codex vs Z.ai vs Ollama local)
- Como dev, quero que minha escolha de modelo persista entre sessões
- Como usuário, quero streaming de tokens em tempo real com Markdown rendering
- Como usuário, quero ver tool calls acontecendo inline (Read, Bash, WebFetch)
- Como usuário, quero poder interromper o assistant no meio do streaming

**Critérios de Aceitação**:
- [ ] Seletor de SDK visível em Settings > Orchestrator
- [ ] Streaming SSE <500ms latência até primeiro token
- [ ] Markdown renderizado com syntax highlighting
- [ ] Tool calls exibidos com input/output colapsáveis
- [ ] Botão "Stop" interrompe generation imediatamente
- [ ] Suporte a attachments (imagens, PDFs, code files)

#### 2.1.2 Sub-Agents (Custom AI Personas)

**Descrição**: Criar e gerenciar agents especializados com system prompts, tools permitidas, e modelos customizados.

**User Stories**:
- Como dev, quero criar um agent "code-reviewer" que só lê código e dá feedback
- Como dev, quero criar um agent "researcher" que usa apenas Read + WebFetch
- Como dev, quero duplicar um agent existente e customizar

**Critérios de Aceitação**:
- [ ] CRUD completo (create, read, update, delete, list)
- [ ] Editor de system prompt com Markdown preview
- [ ] Seletor multi-tool com whitelist visual
- [ ] Seletor de modelo (Sonnet 4.5, Opus 4, GPT-5, etc)
- [ ] Effort level (low/medium/high/max)
- [ ] Thinking mode toggle com budget configurável
- [ ] Max turns configurável (default 80)
- [ ] Squad categorization (harness/workflow/enrich/custom)
- [ ] Sync em massa com orquestrador (alinha todos os agents ao SDK escolhido)

#### 2.1.3 Skills (Markdown Instructions)

**Descrição**: Arquivos Markdown com frontmatter que adicionam capabilities/context ao agent.

**User Stories**:
- Como dev, quero criar uma skill "pdf-processing" com instruções de como parsear PDFs
- Como dev, quero ativar/desativar skills por agent

**Critérios de Aceitação**:
- [ ] CRUD completo
- [ ] Editor Markdown com frontmatter visual
- [ ] Schema de frontmatter validado por Zod
- [ ] Skills bundled (built-in) + custom (user-created)
- [ ] Attach skills a agents específicos

#### 2.1.4 MCP Servers (Model Context Protocol)

**Descrição**: Integrações com serviços externos via protocolo MCP (Google Calendar, Gmail, Drive, Sheets, ElevenLabs, Excalidraw, YouTube, Shopify, etc).

**User Stories**:
- Como usuário, quero conectar minha conta Google para gerenciar Calendar/Gmail/Drive via chat
- Como usuário, quero usar ElevenLabs para TTS de alta qualidade
- Como usuário, quero gerar desenhos Excalidraw inline no chat

**Critérios de Aceitação**:
- [ ] CRUD completo de MCPs custom
- [ ] 19+ MCPs bundled (Google x4, ElevenLabs, Excalidraw, YouTube, Shopify, Nano-banana, Graph search, Local agents, Local LLM, Skills, Memory search, Knowledge base, Wolfkrow internal x3)
- [ ] Start/stop/restart manual
- [ ] Auto-start no boot (configurável por MCP)
- [ ] Visibility toggle (some MCPs só rodam em background)
- [ ] Connection health check
- [ ] Auto-reconnect em caso de crash

#### 2.1.5 Knowledge Base (RAG Local)

**Descrição**: Ingere documentos (PDF, DOCX, CSV, XLSX, MD, URL), gera embeddings, e permite search semântica.

**User Stories**:
- Como researcher, quero ingestar 100 PDFs e perguntar "o que os autores falam sobre X?"
- Como dev, quero ingerir documentação de uma library e fazer Q&A

**Critérios de Aceitação**:
- [ ] Upload drag-and-drop multi-file
- [ ] Parse de PDF/DOCX/CSV/XLSX/MD/URL
- [ ] Chunking inteligente (semantic, não fixed-size)
- [ ] Embeddings via Voyage AI API (voyage-3, 1024 dims) — ver ADR-0028
- [ ] Vector search via sqlite-vec
- [ ] Hybrid search (keyword + semantic)
- [ ] Metadata filtering (data, source, tags)
- [ ] Citation inline (chunk IDs no response)
- [ ] Benchmark suite para avaliar retrieval quality

#### 2.1.6 Memory Pipeline

**Descrição**: Compactação automática de contexto, daily summaries, semantic memories.

**User Stories**:
- Como usuário, quero que o assistant "lembre" de conversas passadas sem eu repetir contexto
- Como usuário, quero daily summaries do que foi discutido

**Critérios de Aceitação**:
- [ ] Compaction automática quando context window > threshold
- [ ] Daily summaries salvos em `.wolfkrow/memory/`
- [ ] Semantic memories (embeddings) para retrieval
- [ ] Manual compaction trigger
- [ ] Compaction logs (audit trail)
- [ ] Configurable trigger (token count, % of context)

#### 2.1.7 Dreaming (Idle Maintenance)

**Descrição**: Quando o assistant está idle, roda maintenance tasks em background (memory consolidation, index updates, etc).

**Critérios de Aceitação**:
- [ ] Detecta idle (no chat activity > 5min)
- [ ] Roda consolidation tasks sem bloquear UI
- [ ] Atualiza embeddings index
- [ ] Gera insights sobre memory
- [ ] Pausa automaticamente quando user volta

#### 2.1.8 Voice Conversation

**Descrição**: Conversa por voz ao vivo com VAD (Voice Activity Detection), barge-in, STT + TTS.

**User Stories**:
- Como usuário, quero falar com o assistant em vez de digitar
- Como usuário, quero que o assistant me interrompa se eu começar a falar

**Critérios de Aceitação**:
- [ ] VAD client-side (Web Audio API)
- [ ] Barge-in (interrompe TTS quando user fala)
- [ ] STT: Whisper local OU OpenAI API (configurável)
- [ ] TTS: ElevenLabs (default) OU Cartesia
- [ ] Voice selection (multiple voices per provider)
- [ ] Visual feedback (orb animado)
- [ ] Latência <500ms end-to-end

#### 2.1.9 Scheduler (Cron Tasks)

**Descrição**: Tarefas agendadas com cron syntax + review queue.

**User Stories**:
- Como dev, quero rodar "code review" toda segunda às 9h
- Como usuário, quero "daily briefing" todo dia às 8h

**Critérios de Aceitação**:
- [ ] Cron syntax editor com preview
- [ ] Time zone aware
- [ ] Manual trigger
- [ ] Review queue (validated/rejected com notes)
- [ ] Activity log (last 30/90/all)
- [ ] Tags + filtering
- [ ] Calendar view + kanban view
- [ ] Pause/resume

#### 2.1.10 Harness System

**Descrição**: Automated code implementation pipeline (Planner→Coder→Evaluator loop).

**User Stories**:
- Como dev, quero descrever uma feature e ter ela implementada + testada automaticamente
- Como founder, quero "construir um MVP" e ter o Wolfkrow quebrar em sprints e implementar

**Critérios de Aceitação**:
- [ ] Spec input (Markdown ou chat)
- [ ] Planner decompõe em sprints com features + acceptance criteria
- [ ] Coder implementa features usando tools (Read, Write, Edit, Bash)
- [ ] Evaluator valida contra acceptance criteria
- [ ] Loop até passar (max configurable rounds)
- [ ] Metrics por round (tokens, cost, duration, tool uses)
- [ ] Diff visualization
- [ ] Manual approval/reject

#### 2.1.11 Pipeline Engine (BuildPlan)

**Descrição**: Multi-stage workflow: discovery → spec-build → spec-validate → approval → implementation.

**User Stories**:
- Como PM, quero descrever um produto e ter discovery + PRD + SPEC gerados

**Critérios de Aceitação**:
- [ ] Stage 1: Discovery (interview user)
- [ ] Stage 2: Spec generation (PRD + SPEC)
- [ ] Stage 3: Spec validation (architecture review)
- [ ] Stage 4: User approval (approve/reject/edit)
- [ ] Stage 5: Implementation (chama Harness)
- [ ] Metrics por stage
- [ ] Pause/resume
- [ ] Branching (approve with edits)

#### 2.1.12 Open Design Studio

**Descrição**: Sub-app Next.js independente para design de interfaces (wireframes, mockups, prototypes).

**User Stories**:
- Como designer, quero criar wireframes de uma feature nova antes de implementar
- Como PM, quero revisar design antes de aprovar spec

**Critérios de Aceitação**:
- [ ] Canvas interativo (Excalidraw-like)
- [ ] Design templates
- [ ] Design systems registry
- [ ] Export para SPEC
- [ ] Versioning
- [ ] Multi-user comments (futuro)

#### 2.1.13 Telegram Bridge

**Descrição**: Bot Telegram que permite conversar com Wolfkrow via Telegram.

**Critérios de Aceitação**:
- [ ] Setup via BotFather token
- [ ] Pairing com Wolfkrow instance (code de 6 dígitos)
- [ ] Mensagens roteadas para chat principal
- [ ] Suporte a attachments
- [ ] Commands (/chat, /new, /memory, /schedule)
- [ ] Multi-device (phone + desktop)

#### 2.1.14 Vault (Secrets)

**Descrição**: Armazenamento criptografado de API keys e secrets via OS keychain.

**User Stories**:
- Como usuário, quero salvar minha OpenAI API key de forma segura
- Como usuário, quero que secrets nunca sejam expostos em logs ou UI

**Critérios de Aceitação**:
- [ ] CRUD de secrets (key + value)
- [ ] Encryption via keytar (OS keychain)
- [ ] Nunca exibido em logs
- [ ] Masked em UI (só últimos 4 chars)
- [ ] Audit log de acessos
- [ ] Export/import encrypted backup

#### 2.1.15 Auth + Security

**Descrição**: Password + TOTP 2FA + auto-lock.

**Critérios de Aceitação**:
- [ ] Password bcrypt hash
- [ ] TOTP opcional (otplib)
- [ ] Auto-lock em idle > 5min OU tab hidden
- [ ] Session timeout configurável
- [ ] Lock screen com password re-prompt
- [ ] Failed attempts lockout (5 tentativas → lock 5min)

### 2.2 Funcionalidades Pós-MVP (Roadmap v1.1+)

- **Multi-workspace**: separar `.wolfkrow/profiles/` por contexto
- **Cloud sync opcional**: sync entre devices (opt-in)
- **Plugin marketplace**: registry de MCPs e skills
- **Screen awareness**: Electron desktopCapturer + Claude vision
- **Hotkey global**: Cmd+Shift+Space para abrir chat
- **Browser extension**: send URL to chat
- **Mobile companion**: Tauri/Expo app
- **Inbox Zero para Telegram**: auto-triage
- **Calendar agent**: Google Calendar MCP + scheduling
- **Email digest diário**: Gmail MCP + summary
- **Code review bot**: GitHub webhook
- **Standup automático**: Slack/Discord integration

---

## 3. Não-Objetivos (v1.0)

- ❌ **Multi-tenant** (single-user only)
- ❌ **Cloud-hosted** (100% self-hosted)
- ❌ **Mobile-first** (PWA é bônus, não prioridade)
- ❌ **Real-time collaboration** (single-user only)
- ❌ **Voice cloning** (v1.1+)
- ❌ **Fine-tuning de modelos** (v2.0+)

---

## 4. Personas & User Stories Detalhadas

### 4.1 Persona: Dev Solo

**Background**:
- Senior full-stack dev
- Stack: TypeScript, React, Node, PostgreSQL
- Trabalha em 2-3 projetos side
- Usa GitHub Copilot + Cursor
- Valoriza privacy (não quer código em cloud)

**Workflow típico**:
1. Acorda, abre Wolfkrow via hotkey
2. Pergunta "o que tem na minha inbox?" → bot resume emails
3. Pede "review o PR #123" → agent analiza diff + comenta
4. Diz "implementa a feature X" → Harness roda Planner→Coder→Evaluator
5. Faz daily standup via Telegram enquanto commute

**Pain points atuais**:
- ChatGPT esquece contexto entre sessões
- Cursor não tem acesso ao filesystem completo
- Não consegue orquestrar múltiplos agents

**Como Wolfkrow resolve**:
- Memory pipeline mantém contexto cross-session
- Worker tem acesso completo a terminal + filesystem
- Harness + Pipeline orquestram multi-agent

### 4.2 Persona: Researcher

**Background**:
- PhD em ML
- Stack: Python, PyTorch, Jupyter
- Processa 100+ papers/mês
- Precisa de RAG sobre literature proprietário

**Workflow típico**:
1. Ingere 50 PDFs de papers recentes
2. Pergunta "compare as abordagens de X vs Y"
3. Wolfkrow busca semanticamente + cita fontes
4. Exporta summary para Markdown

**Como Wolfkrow resolve**:
- Knowledge engine ingere + embed + index
- Hybrid search (semantic + keyword)
- Citation inline

### 4.3 Persona: Knowledge Worker

**Background**:
- Founder de SaaS
- Gerencia múltiplas contas
- Quer inbox zero
- Usa Telegram como chat principal

**Workflow típico**:
1. Telegram message → Wolfkrow processa
2. Calendar conflicts → sugere resolutions
3. Daily briefing às 8h (cron)
4. Weekly summary domingo 20h

**Como Wolfkrow resolve**:
- Telegram bridge
- Google Calendar MCP
- Scheduler
- Memory pipeline para briefings

---

## 5. Métricas de Sucesso

### 5.1 North Star Metric

**Weekly Active Conversations (WAC)**: número de sessões de chat ativas por semana.

Meta v1.0: **50 WAC** (single-user pode ter 50+ conversas/semana).

### 5.2 KPIs Secundários

| KPI | Meta v1.0 | Como medir |
|---|---|---|
| Time to first response (TTFR) | <500ms (P95) | Métricas coletadas no Worker |
| Compaction success rate | >95% | Memory pipeline logs |
| Harness success rate | >70% | Round metrics |
| Knowledge retrieval precision@5 | >0.80 | Benchmark suite |
| Crash-free sessions | >99.5% | Sentry (opt-in) |
| Daily active use | >4 dias/semana | Telemetry opt-in |
| Setup time (install → first chat) | <10min | User feedback |

### 5.3 Anti-métricas (não otimizar)

- ❌ Número de MCPs instalados (quality > quantity)
- ❌ Token usage (eficiência > economia)
- ❌ Latência <100ms (UX > raw speed)

---

## 6. Modelo de Distribuição

### 6.1 Formas

1. **PWA installable** (grátis, recomendado)
   - Browser adiciona à home screen
   - Funciona offline (shell cached)
   - Auto-update via versioning

2. **Binário Electron wrapper** (~$0, recomendado para desktop)
   - DMG macOS (x64 + arm64)
   - NSIS Windows x64
   - AppImage Linux x64
   - Inclui systray + hotkey global

3. **Source build** (open-source, devs)
   - `pnpm install && pnpm dev`
   - Requer Node 20+, pnpm 9+

4. **Cloud self-hosted** (futuro, v2.0)
   - Docker image
   - Kubernetes Helm chart
   - Para power users multi-device

### 6.2 Licenciamento

**UNLICENSED** (proprietário, copyright Wolfkrow Labs).
Open-source seletivo: extraction de libraries internas para npm público (`@wolfkrow/ai-core`, `@wolfkrow/domain`, etc).

---

## 7. Requisitos Técnicos

### 7.1 Mínimos (user)

| Recurso | Mínimo | Recomendado |
|---|---|---|
| OS | macOS 12+, Windows 10+, Linux (Ubuntu 22+) | macOS 14+ |
| RAM | 8 GB | 16 GB |
| Disk | 2 GB | 5 GB |
| Node | 20+ | 22+ |
| Browser | Chrome 120+ | Chrome latest |

### 7.2 Opcionais (funcionalidades específicas)

| Feature | Requisito extra |
|---|---|
| Whisper local | +500 MB disk, +2 GB RAM |
| MCPs Google (Calendar/Gmail/Drive/Sheets) | OAuth credentials |
| Telegram bot | BotFather token |
| Voice (TTS ElevenLabs) | API key |
| Voice (TTS Cartesia) | API key |

---

## 8. Riscos & Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | SSE não funciona em corporate firewalls | Média | Alto | Fallback long-polling |
| 2 | Whisper local consome muita RAM | Média | Médio | OpenAI Whisper API como alternativa |
| 3 | 78 SQLite migrations não portam 1:1 | Alta | Alto | Re-derivar schema Drizzle do zero |
| 4 | Code signing caro ($100/ano Apple, $200+ Windows) | Alta | Médio | Self-signed dev, doc signing para prod |
| 5 | Browser throttling de SSE em background | Alta | Médio | Service Worker + documentar "manter tab aberta" |
| 6 | Codex CLI OAuth requer callback acessível | Alta | Médio | Local server em porta 1455 |
| 7 | 19 MCPs quebram em updates | Média | Médio | Versioning + smoke tests por MCP |
| 8 | Time-to-market longo (5 meses) | Média | Alto | MVP focado em core (chat + knowledge + harness) |

---

## 9. Roadmap de Releases

### v1.0 (M6 — dia 136)
- Chat multi-SDK
- Sub-agents + Skills
- 19 MCPs bundled
- Knowledge engine
- Memory pipeline
- Voice conversation
- Scheduler
- Harness system
- Pipeline engine (BuildPlan)
- Open Design Studio
- Telegram bridge
- Vault
- Auth + TOTP
- PWA installable
- Electron wrapper (systray + hotkey)
- DMG + NSIS + AppImage

### v1.1 (M6+30 dias)
- Multi-workspace
- Plugin marketplace (curated)
- Hotkey global config
- Browser extension (Chrome)
- Inbox Zero para Telegram

### v1.2 (M6+60 dias)
- Mobile companion (iOS + Android via Expo)
- Cloud sync opt-in
- Screen awareness (Electron desktopCapturer)
- Voice cloning

### v2.0 (M6+120 dias)
- Cloud self-hosted (Docker + Helm)
- Real-time collaboration (multi-user)
- Fine-tuning de modelos (LoRA)
- Custom AI providers (BYO endpoint)

---

## 10. Critérios de Done (Definition of Done)

Para uma feature ser considerada "Done":

- [ ] Spec escrita em `docs/specs/SPEC-XXX.md`
- [ ] Testes escritos ANTES (TDD) e passando (≥85% coverage backend, ≥70% frontend)
- [ ] Implementação completa (sem TODOs, sem FIXMEs)
- [ ] TypeScript strict mode passa (`pnpm typecheck`)
- [ ] ESLint passa (`pnpm lint`)
- [ ] Prettier formatado
- [ ] Manual testing em Chrome/Edge/Firefox
- [ ] Documentation atualizada (README, AGENT.md, JSDoc)
- [ ] ADR criado se decisão arquitetural nova
- [ ] CHANGELOG atualizado
- [ ] PR reviewed por 1+ dev
- [ ] CI green (lint + typecheck + test + build)

---

## 11. Stakeholders

| Papel | Pessoa | Responsabilidade |
|---|---|---|
| Product Owner | Junior Faria | Visão, priorização, acceptance |
| Tech Lead | Junior Faria | Arquitetura, code review |
| Dev Frontend | TBD | Next.js + shadcn |
| Dev Backend | TBD | Worker + AI providers |
| DevOps | TBD | CI/CD + distribuição |
| QA | TBD | E2E + manual testing |
| Designer | TBD | UI/UX polish |

---

## Apêndice A — Comparação com Concorrentes

| Feature | Wolfkrow | ChatGPT | Claude.ai | Cursor | Devon | OpenHands |
|---|---|---|---|---|---|---|
| Self-hosted | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Terminal access | ✅ | ❌ | ❌ | ⚠️ limited | ✅ | ✅ |
| Multi-agent orchestration | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Memory persistente | ✅ | ⚠️ limited | ⚠️ limited | ⚠️ project | ❌ | ❌ |
| MCP support | ✅ | ❌ | ❌ | ⚠️ limited | ⚠️ | ⚠️ |
| Voice conversation | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Knowledge RAG | ✅ | ⚠️ | ❌ | ⚠️ codebase | ❌ | ❌ |
| Cron/scheduler | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Telegram integration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Price | Free (self-hosted) | $20/m | $20/m | $20/m | $20/m | Free |

**Diferencial único**: Wolfkrow é o **único** que combina self-hosted + multi-agent + memory persistente + MCP ecosystem + voice.

---

## Apêndice B — Pricing Tiers (Futuro)

| Tier | Preço | Features |
|---|---|---|
| **Community** | Free | Self-hosted, all features, community support |
| **Pro** | $20/m | Cloud-hosted managed, priority support, cloud sync |
| **Team** | $50/user/m | Multi-user, collaboration, SSO, audit logs |
| **Enterprise** | Custom | On-premise, SLA, dedicated support, custom integrations |

---

**Aprovação necessária**: Product Owner + Tech Lead.
