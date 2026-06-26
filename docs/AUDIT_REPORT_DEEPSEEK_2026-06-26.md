# AUDITORIA GERAL - Wolfkrow Tool vs Lionclaw v1.0
## Data: 2026-06-26 | Auditoria: DeepSeek V4 Pro

---

## RESUMO EXECUTIVO

Auditoria completa comparando **Wolfkrow Tool** (Next.js 15 + Fastify Worker) contra **Lionclaw v3.0.0** (Electron + React 19 + SQLite). O objetivo é garantir que o **MVP do Wolfkrow** contenha **todas as funcionalidades do Lionclaw**, com melhorias de arquitetura, código e usabilidade.

### Resultado Geral

| Categoria | Quantidade |
|-----------|------------|
| Funcionalidades Lionclaw analisadas | ~85 |
| Funcionalidades implementadas corretamente | ~45 (53%) |
| Funcionalidades implementadas parcialmente | ~15 (18%) |
| Funcionalidades ausentes (GAP) | ~20 (23%) |
| Bugs críticos identificados | 2 |
| Bugs não-críticos | 3 |
| Problemas de UI/UX | 8 |
| Violações de padrão do projeto | 6 |

---

## 1. BUGS CRÍTICOS (BLOQUEADORES)

### BUG-001: FOREIGN KEY no Chat sem Agent

**Severidade:** CRÍTICO  
**Arquivo:** `packages/infra/src/db/schema/chat.ts:17-20`, `packages/infra/src/repos/chat-repos.ts:26`  
**Sintoma:** `SqliteError: FOREIGN KEY constraint failed` ao enviar mensagem sem agente selecionado

**Causa Raiz:** O schema `chat_sessions.agent_id` é `NOT NULL` com FK para `agents.id`. Quando o usuário envia chat diretamente (sem selecionar agente), `agentId` é `undefined`, convertido para string vazia `''` no repo, quebrando a constraint FK.

**Stack trace:**
```
DrizzleChatSessionRepo.save (.../chat-repos.ts:51)
SendMessageUseCase.loadOrCreateSession (.../send-message.ts:64)
```

**Solução:**
1. Remover `.notNull()` da coluna `agent_id` em `packages/infra/src/db/schema/chat.ts`
2. Alterar `session.agentId ?? ''` para `session.agentId ?? null` em `packages/infra/src/repos/chat-repos.ts`
3. Gerar nova migration Drizzle

---

### BUG-002: Auto-Lock Dispara em 5 Minutos (Deveria Ser 30 Dias)

**Severidade:** CRÍTICO  
**Arquivo:** `apps/web/hooks/use-auto-lock.ts:6-34`  
**Sintoma:** Usuário é desconectado após 5 minutos de inatividade ou ao trocar de aba

**Causa Raiz:** O hook `useAutoLock` define `IDLE_MS = 5 * 60 * 1000` (5 minutos) e dispara lock no evento `visibilitychange` quando `document.hidden === true`. O requisito especifica que o lock deve ocorrer apenas quando o token JWT expira (30 dias).

**Solução:**
1. Remover o handler de `visibilitychange` (linhas 31-34)
2. Alterar `IDLE_MS` para `30 * 24 * 60 * 60 * 1000` (30 dias) OU
3. Implementar lock baseado na claim `exp` do JWT, verificando periodicamente (a cada hora) se o token expirou

---

## 2. FUNCIONALIDADES AUSENTES (GAPs LIONCLAW → WOLFKROW)

### 2.1 Chat & Mensageria

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-001 | Seleção de Agent por sessão no chat | **AUSENTE** — `chat-hooks.ts` não envia `agentId` | P0 |
| GAP-002 | Seleção explícita de Provider no chat | **PARCIAL** — `ModelPicker` infere provider do modelo; sem seletor explícito | P0 |
| GAP-003 | Slash commands (`/`) no chat | **AUSENTE** | P1 |
| GAP-004 | Contador de tokens em tempo real | **AUSENTE** | P1 |
| GAP-005 | Histórico de sessões no sidebar do chat | **PARCIAL** — existe listagem mas sem métricas (tokens) | P2 |

### 2.2 Agents/SubAgents

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-006 | Campo `maxToolRounds` no Agent | **AUSENTE** — não existe no schema, form, nem AgentData | P0 |
| GAP-007 | Campo `description` no formulário | **AUSENTE** — definido no schema mas não renderizado no form | P1 |
| GAP-008 | Campo `squad` no formulário | **AUSENTE** — definido no schema mas sem controle no form | P1 |
| GAP-009 | Campo `mcpServers` no formulário | **AUSENTE** — definido no schema, enviado na API, mas sem tab/form control | P1 |
| GAP-010 | Campo `isActive` no formulário | **AUSENTE** — no schema mas sem controle no form (só toggle na lista) | P2 |
| GAP-011 | Editor Markdown para system prompt | **AUSENTE** — usa `<Textarea rows={3}>` simples | P1 |
| GAP-012 | Edição em página dedicada | **DIFERENTE** — usa modal Dialog, não full page | P1 |
| GAP-013 | Troca dinâmica de provider/model no form | **PARCIAL** — provider dropdown existe, mas modelo carrega todos sem filtrar por provider | P0 |
| GAP-014 | ContextWindowDisplay no agent list | **AUSENTE** | P2 |
| GAP-015 | ApiKeyStatusIndicator no agent list | **AUSENTE** | P2 |
| GAP-016 | 71 seed agents carregados para usuário | **PARCIAL** — seeding só roda quando user tem 0 agents | P1 |

### 2.3 Skills

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-017 | Tabela (DataTable) igual agents | **DIFERENTE** — usa cards em grid, não tabela | P1 |
| GAP-018 | Edição em página dedicada com markdown editor | **DIFERENTE** — usa modal Dialog | P1 |
| GAP-019 | Suporte a YAML frontmatter | **AUSENTE** — conteúdo é markdown puro, sem frontmatter | P0 |
| GAP-020 | Suporte a arquivos auxiliares (`hasAuxFiles`) | **AUSENTE** | P2 |

### 2.4 Rules

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-021 | Tabela (DataTable) igual agents | **DIFERENTE** — cards agrupados por kind, não tabela | P1 |
| GAP-022 | Edição em página dedicada com markdown editor | **AUSENTE** — usa inline `<textarea>` simples | P1 |
| GAP-023 | Regras por agent (`per-agent rules`) | **AUSENTE** — apenas regras globais | P2 |
| GAP-024 | Arquivos físicos (RULES.md, SOUL.md, USER.md) | **DIFERENTE** — armazenamento em DB, não arquivos | P2 |

### 2.5 MCP Servers

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-025 | Tabela (DataTable) igual agents | **DIFERENTE** — usa cards em grid, não tabela | P1 |
| GAP-026 | Edição em página dedicada | **DIFERENTE** — usa modal Dialog | P1 |
| GAP-027 | Formulário completo de MCP | **AUSENTE** — apenas Name/Command/Args. Sem transport type, URL, env vars, headers | P0 |
| GAP-028 | Exibição de MCPs na tela | **POSSÍVEL BUG** — usuário reporta "nao esta sendo exibido nenhum mcp" | P0 |
| GAP-029 | Botão "Test Connection" | **AUSENTE** | P2 |

### 2.6 Providers

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-030 | Botão "Test Connection" | **AUSENTE** | P1 |
| GAP-031 | Override cria novo registro | **POSSÍVEL BUG** — upsert baseado em `displayName` slug | P1 |
| GAP-032 | Campos não carregam ao editar | **POSSÍVEL BUG** — `buildProviderFormValues` deve resolver, mas `id` field precisa estar correto | P1 |
| GAP-033 | OrchestratorSelector no chat/settings | **AUSENTE** — sem seletor explícito de orquestrador | P1 |

### 2.7 Pipeline

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-034 | 14-17 fases (vs 5 stages) | **AUSENTE** — apenas 5 estágios (discovery, spec_build, spec_validate, approval, implementation) | P0 |
| GAP-035 | Pipeline Chat por fase | **AUSENTE** | P0 |
| GAP-036 | Document Preview | **AUSENTE** — mostra apenas path do artifact | P1 |
| GAP-037 | Reset de fases/sprints | **AUSENTE** | P1 |
| GAP-038 | Project path no formulário de criação | **AUSENTE** — pipeline só tem name+description | P0 |
| GAP-039 | Métricas detalhadas por fase | **PARCIAL** — apenas tokens + fases completadas | P2 |
| GAP-040 | Tela de execução/monitoramento | **PARCIAL** — fluxo existe mas UI é confusa (usuário reporta) | P0 |
| GAP-041 | Integração com OpenDesign | **AUSENTE** — OpenDesign é standalone, não integrado ao pipeline | P1 |

### 2.8 Harness

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-042 | Tela de acompanhamento e interação | **PARCIAL** — ExecutionView existe, mas usuário reporta "nao é aberto tela" | P0 |
| GAP-043 | 5-agent execution (vs 2-agent coder+evaluator) | **DIFERENTE** — apenas coder+evaluator | P2 |
| GAP-044 | Auditoria no fluxo — path do projeto | **PENDENTE** — campo `projectPath` existe no form, verificar uso | P1 |

### 2.9 Outros

| ID | Funcionalidade Lionclaw | Status Wolfkrow | Prioridade |
|----|-------------------------|-----------------|------------|
| GAP-045 | SDK Setup Wizard no primeiro acesso | **AUSENTE** | P1 |
| GAP-046 | Onboarding interview (BOOTSTRAP.md) | **AUSENTE** | P2 |
| GAP-047 | Canal Channels (apenas Telegram funcional) | **PARCIAL** — só Telegram implementado | P1 |
| GAP-048 | Métricas/Dashboard com gráficos | **PARCIAL** — apenas KPIs numéricos, sem gráficos | P1 |
| GAP-049 | Cadastro de Projetos | **PARCIAL** — pipeline e harness têm cadastro, mas sem projeto standalone | P1 |
| GAP-050 | CodeBurn (PTY interativo) | **PARCIAL** — terminal existe mas sem integração com chat | P2 |

---

## 3. PROBLEMAS DE UI/UX

### 3.1 Inconsistência de Padrões

| ID | Problema | Detalhe |
|----|----------|---------|
| UX-001 | Skills usa **cards**, Agents usa **tabela** | Padrão inconsistente entre páginas similares |
| UX-002 | Rules usa **cards agrupados**, Agents usa **tabela** | Padrão inconsistente |
| UX-003 | MCP usa **cards**, Agents usa **tabela** | Padrão inconsistente |
| UX-004 | Agents edita em **modal**, deveria ser **página dedicada** | Forms complexos não cabem em modal |
| UX-005 | Skills edita em **modal**, deveria ser **página dedicada** | Markdown editor precisa de espaço |
| UX-006 | Rules edita **inline**, deveria ser **página dedicada** | Falta editor markdown |
| UX-007 | MCP edita em **modal**, deveria ser **página dedicada** | Form precisa de mais campos |

### 3.2 Layout e Disposição

| ID | Problema | Detalhe |
|----|----------|---------|
| UX-008 | Pipeline/Harness layout confuso | Layout inconsistente com restante da app |
| UX-009 | Pipeline: template picker não integrado ao fluxo | Componente existe mas não usado na view principal |
| UX-010 | Dashboard sem gráficos visuais | Apenas números; sem charts de atividade/tendência |
| UX-011 | MCP form extremamente minimalista | 3 campos apenas; faltam transport, URL, env vars, headers |
| UX-012 | Topbar inconsistente em telas flush vs normais | `/chat`, `/terminal`, `/graph`, `/design` têm topbar diferente |

---

## 4. VIOLAÇÕES DE PADRÃO DO PROJETO

| ID | Violação | Detalhe | ADR/SPEC referência |
|----|----------|---------|---------------------|
| STD-001 | `maxToolRounds` ausente do domain | Campo essencial do Lionclaw não mapeado no schema | SPEC-013 |
| STD-002 | `mcpServers` no schema mas sem form control | Campo definido não exposto ao usuário | SPEC-013 |
| STD-003 | `squad` no schema mas sem form control | Campo definido não exposto ao usuário | SPEC-013 |
| STD-004 | Pipeline com apenas 5 stages | Lionclaw tem 14-17 fases mapeadas por pipeline type | SPEC-006 |
| STD-005 | YAML frontmatter não implementado em Skills | Lionclaw usa frontmatter para metadata de skills | SPEC-014 |
| STD-006 | Seed agents não idempotente para usuários existentes | Só seeda quando user tem 0 agents | SPEC-014 |

---

## 5. ANÁLISE DE INTEGRAÇÃO SDK

### 5.1 Roteamento de Provider

A análise do `orchestrator.ts` e `claude-compat.ts` confirma que:

- ✅ **GLM (Z.ai):** Roteado via `claude-compat:zai` com URL Zhipu e API key do vault
- ✅ **Kimi (Moonshot):** Roteado via `claude-compat:moonshot` com URL Moonshot
- ✅ **MiniMax:** Roteado via `claude-compat:minimax` com URL MiniMax
- ✅ **Qwen (DashScope):** Roteado via `claude-compat:qwen` com URL Alibaba
- ✅ **Anthropic nativo:** Roteado via `cloud` runtime → AnthropicProvider
- ✅ **Codex/OpenAI:** Roteado via `codex` runtime → CodexProvider
- ✅ **Ollama:** Roteado via `local` runtime → Ollama (OpenAI-compat endpoint)

**Conclusão:** SDK routing está correto. Override de URL, API key e models funciona via configuração de provider.

### 5.2 Claude-Compat SDK

A implementação `ClaudeCompatProvider` usa o SDK Anthropic oficial (`@anthropic-ai/sdk`) com `baseURL` customizado. Correto.

---

## 6. ANÁLISE CHAT AGENT

### Erro FOREIGN KEY

Confirmado e documentado em BUG-001. Causa: `agent_id` NOT NULL no schema vs `agentId` optional no domain.

### Seleção de Provider/Model no Chat

- `ModelPicker` existe e lista modelos agrupados por provider
- Persiste seleção em `localStorage` (`wolfkrow.chat.model.v1`)
- Provider é **inferido** do modelo, não selecionado explicitamente
- NÃO envia `agentId` no SSE (chat sem agente)

---

## 7. ANÁLISE OPENDESIGN

- Sidecar manager funcional
- Bootstrap, snapshot, lock implementados
- Design Studio renderizado em iframe standalone
- **NÃO integrado ao fluxo do Pipeline** (Lionclaw integra Design phase no pipeline dev-v2)

---

## 8. VERIFICAÇÃO DO CHECKLIST

| Item | Status | Observação |
|------|--------|------------|
| Item foi realmente implementado | ⚠️ 85% | 53% completo, 18% parcial |
| Item implementado de forma funcional | ⚠️ 70% | Bugs críticos (chat FK, auto-lock) |
| Item segue a definição do plano | ⚠️ 75% | Pipeline com menos fases que planejado |
| Clean Code | ⚠️ 80% | Boa estrutura, mas arquivos grandes |
| Clean Architecture | ✅ 90% | 4 camadas bem definidas |
| SOLID | ✅ 85% | DI container, interfaces bem definidas |
| DRY | ✅ 80% | Schemas Zod reutilizados |
| YAGNI | ✅ 90% | Funcionalidades focadas no MVP |
| Sem bugs | ❌ | 2 bugs críticos, 3 não-críticos |
| Sem débito técnico | ⚠️ | GAPs de funcionalidade acumulados |
| Testes unitários sem falhas | ❓ | Não verificado nesta auditoria |
| Testes realmente validam código | ❓ | Não verificado nesta auditoria |
| Segue todos requisitos do plano | ❌ 53% | ~20 funcionalidades Lionclaw ausentes |
| Segue padrão de qualidade do projeto | ⚠️ 80% | Inconsistências de UI/UX e alguns campos faltantes |
| Layout moderno, minimalista, impactante | ⚠️ 70% | Layout base sólido, mas inconsistências e gaps visuais |
| Layout e componentes padronizados | ❌ 60% | Cards vs Tabela; Modal vs Full Page inconsistentes |
| Frontend reflete todas funcionalidades | ❌ 53% | Muitos gaps de funcionalidade |
| Integração backend-frontend funcional | ⚠️ | Chat FK bug quebra integração |
| Layout bem distribuído e otimizado | ⚠️ 75% | Pipeline/Harness layout precisa de redesign |
| Frontend melhores práticas UI/UX | ⚠️ 70% | Inconsistências de padrão de edição/navegação |
| Frontend sem ambiguidade | ⚠️ | Menu items claros, mas fluxos inconsistentes |

---

## 9. CONCLUSÃO

O Wolfkrow Tool está aproximadamente **53% completo** em relação ao Lionclaw v1.0. As principais áreas problemáticas são:

1. **Chat sem suporte a agentes** — funcionalidade central do Lionclaw
2. **Pipeline com escopo reduzido** — apenas 5 estágios dos 14-17 do Lionclaw
3. **UI inconsistente** — padrões diferentes para telas similares
4. **2 bugs críticos** — Chat FK error e Auto-lock prematuro
5. **~20 funcionalidades ausentes** — entre campos de formulário, fluxos e integrações

O plano de implementação detalhado para corrigir todos os gaps está em `mvp_final_plan_v2_deepseek.md`.
