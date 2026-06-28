# Migrating from LionClaw to Wolfkrow

This guide walks through migrating your data from LionClaw v3.0 to Wolfkrow.

## What migrates automatically

| LionClaw table        | Wolfkrow table        | Notes                                                   |
| --------------------- | --------------------- | ------------------------------------------------------- |
| `users`               | `users`               | All user accounts                                       |
| `agents`              | `agents`              | Agent configurations                                    |
| `chat_sessions`       | `chat_sessions`       | Conversation sessions                                   |
| `chat_messages`       | `chat_messages`       | Full message history                                    |
| `knowledge_documents` | `knowledge_documents` | Document index                                          |
| `knowledge_chunks`    | `knowledge_chunks`    | Chunked knowledge                                       |
| `memory`              | `semantic_memories`   | Long-term memories                                      |
| `secrets`             | `vault_secrets`       | Keys are migrated; values must be re-entered (security) |
| `mcp_servers`         | `mcp_servers`         | MCP server configs                                      |
| `scheduled_tasks`     | `scheduled_tasks`     | Cron tasks                                              |

> **Vault values**: Secret values and encrypted payloads are intentionally skipped during migration. After migrating, re-enter API keys via **Settings → Vault**.

## Prerequisites

- LionClaw v3.0 installed (or a `.db` file from a LionClaw backup)
- Wolfkrow installed and configured (run `wolfkrow` at least once to initialize the DB)
- Node.js 24+

## Step-by-step migration

### 1. Find your LionClaw database

```bash
# Default location:
ls ~/.lionclaw/data.db

# Or check LionClaw settings for a custom path
```

### 2. Dry run (recommended first)

Preview what will be migrated without writing anything:

```bash
pnpm migrate:lionclaw --from ~/.lionclaw/data.db --dry-run
```

Output shows per-table row counts and any skipped records.

### 3. Run migration

```bash
pnpm migrate:lionclaw --from ~/.lionclaw/data.db
```

A backup of your Wolfkrow database is created automatically at:

```
.wolfkrow/data/wolfkrow.db.backup-pre-migration-<timestamp>
```

### 4. Selective migration

Migrate only specific tables:

```bash
pnpm migrate:lionclaw --from ~/.lionclaw/data.db --tables agents,chat_sessions,chat_messages
```

### 5. Verify

After migration, start Wolfkrow and confirm:

- Agents appear in **Settings → Agents**
- Chat history appears in the **Chat** sidebar
- Knowledge documents appear in **Knowledge → Documents**
- Scheduled tasks appear in **Settings → Automation**

### 6. Re-enter vault secrets

Vault values cannot be migrated automatically (they are end-to-end encrypted in LionClaw). Go to **Settings → Vault** and re-enter:

- Anthropic API key
- Any other API keys or credentials

## Rollback

If something goes wrong, restore the pre-migration backup:

```bash
pnpm migrate:lionclaw --rollback --to .wolfkrow/data/wolfkrow.db
```

This restores the backup created in step 3.

## Migration report

After each migration run, a JSON report is saved:

```
migration-report-<timestamp>.json
```

It contains per-table statistics: total rows, migrated rows, skipped rows (duplicate PKs), and any errors.

## Decisões de escopo (diferenças intencionais vs LionClaw)

### Consolidação de executors (LionClaw → Wolfkrow)

LionClaw tinha executors separados por provider (`zai-executor`, `google-genai-executor`, `minimax-executor`, etc.). No Wolfkrow, esses foram **consolidados via OpenRouter**:

| LionClaw executor       | Wolfkrow equivalente                      |
| ----------------------- | ----------------------------------------- |
| `zai-executor`          | OpenRouter com prefix `openrouter/`       |
| `google-genai-executor` | OpenRouter com `google/gemini-*`          |
| `minimax-executor`      | OpenRouter com `minimax/*`                |
| `codex-executor`        | `CodexProvider` (mantido, OAuth próprio)  |
| `anthropic-executor`    | `AnthropicProvider` (mantido, SDK direto) |

Para usar providers via OpenRouter, configure o prefixo correto no vault e selecione `openrouter` como provider no onboarding.

### ClaudeCompatProvider — novo em v1.0

O Wolfkrow v1.0 adiciona `ClaudeCompatProvider` (ADR-0030), que cobre APIs OpenAI-compatíveis que aceitam o prefixo `claude-` nos modelos (ex: OpenRouter). Permite usar modelos Anthropic via proxy sem SDK direto.

| Provider LionClaw  | Provider Wolfkrow      | Notas                                         |
| ------------------ | ---------------------- | --------------------------------------------- |
| anthropic-executor | `AnthropicProvider`    | SDK direto — mantido                          |
| (sem equivalente)  | `ClaudeCompatProvider` | OpenAI-compat com modelos claude-\* via proxy |
| codex-executor     | `CodexProvider`        | Mantido — OpenAI + Ollama                     |
| (sem equivalente)  | `OpenRouterProvider`   | openrouter/\* prefix — 100+ modelos           |

Para migrar agentes que usavam `anthropic-executor` em LionClaw: selecione `anthropic` como provider no onboarding e configure `ANTHROPIC_API_KEY` no Vault.

### Runtime Node 24

O Wolfkrow v1.0 requer **Node.js 24+** (ADR-0029). O LionClaw rodava em Node 18/20. Antes de migrar:

```bash
node --version  # Deve mostrar v24.x.x ou superior
```

Se necessário, instale via nvm:

```bash
nvm install 24 && nvm use 24
```

### Tabelas sem equivalente no LionClaw (novas em Wolfkrow)

As tabelas abaixo não existem no LionClaw e não são migradas — são inicializadas vazias:

| Tabela Wolfkrow                                           | Descrição                                               |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `audit_events`                                            | Log de todas as tool calls dos agentes                  |
| `knowledge_chunks_vec`                                    | Índice vetorial sqlite-vec (se disponível)              |
| `usage_records`                                           | Histórico de uso de tokens por sessão                   |
| `workflow_runs` / `workflow_steps`                        | Runs do sistema de workflow (Harness/Pipeline)          |
| `harness_projects` / `harness_sprints` / `harness_rounds` | Projetos e sprints do Harness                           |
| `pipeline_projects` / `pipeline_stages`                   | Projetos e etapas do Pipeline                           |
| `enrichments`                                             | Resultados do pipeline Enrich                           |
| `permissions`                                             | Permissões de tool calls por agente                     |
| `skills`                                                  | Skills (Markdown instructions) — sem equivalente direto |

### Adições não presentes no LionClaw

Funcionalidades novas adicionadas durante o desenvolvimento do Wolfkrow:

| Feature                      | Decisão                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| OpenRouter                   | Substitui integração direta zai/google/minimax — um key, acesso a 100+ modelos |
| ClaudeCompatProvider         | Novo provider OpenAI-compat para claude-\* via proxy (ADR-0030)                |
| Storybook                    | Design system documentation — sem equivalente no LionClaw                      |
| Design tokens (Tailwind v4)  | Sistema de tokens CSS — sem equivalente no LionClaw                            |
| Pipeline run phases (T26)    | Fase de execução IA por estágio — feature nova                                 |
| Auto-compaction (T29)        | Threshold-based session compaction — feature nova                              |
| Whisper.cpp subprocess (T28) | STT local sem custo por token — feature nova                                   |
| EventBus de domínio          | `message.turn.completed` e outros domain events — sem equivalente              |

### Histórico de mensagens

A migração de `chat_messages` é válida a partir da **Task 18** (SendMessageUseCase com persistência Drizzle). Versões do Wolfkrow anteriores a Task 18 usavam sessões in-memory — não há dados de histórico para migrar dessas versões.

## Troubleshooting

**"LionClaw DB not found"**: Pass the correct path with `--from`. You can also export from LionClaw via _Settings → Export → SQLite backup_.

**"Table not found in source"**: LionClaw version mismatch. The migrator requires LionClaw v3.0+.

**"Schema mismatch"**: The migrator applies column-level mapping and can handle minor schema drift. If you see this error, open an issue with your LionClaw version.

**Rollback fails**: If the backup file was deleted, recover from a Time Machine or system backup. The Wolfkrow DB is at `.wolfkrow/data/wolfkrow.db`.

## Checklist de paridade pós-migração (GLM branch, 2026-06-28)

Funcionalidades com parity validada após o branch `feat/mvp-glm-f1-f2`:

| Funcionalidade LionClaw          | Status Wolfkrow        | Notas                                                               |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| Chat com qualquer provider       | ✅ parity              | GLM/kimi/minimax/qwen via `claude-compat:*` (F1.1, F1.2)           |
| Pipeline enriquece com provider  | ✅ parity              | `resolveAIProvider` no enrich (F1.3)                                |
| Sidecar requer autenticação      | ✅ parity              | JWT auth em todas as rotas sidecar (F1.4)                           |
| Criar projeto harness/pipeline   | ✅ parity              | `validateSpecPath` + `projectPath` propagado (F1.5)                 |
| HITL — chat durante execução     | ✅ parity              | feedback endpoint retorna mensagem real (F2.1)                      |
| Run abre console automaticamente | ✅ parity              | `autoplay=1` detectado em navegação (F2.2)                          |
| Timeline de fases na listagem    | ✅ parity              | `PipelineStageProgress` vertical (F2.6)                             |
| Métricas de tokens por round     | ✅ parity              | `MetricsChart` recharts com coder/evaluator (F2.4)                  |
| Sidebar com contagens            | ✅ parity              | `SidebarMenuBadge` em Agents/Skills/MCP (F3.4)                      |
| Channels — test connection       | ✅ parity              | Telegram `getMe` via `POST /telegram/test` (F4.5)                   |
| Provider override (upsert)       | ✅ parity              | UNIQUE(userId, providerId) + migration 0015 (F4.4)                  |
| Skills "Criar com Assistente"    | ✅ parity              | Botão abre `/chat?agent=skill-creator` (F4.2)                       |
| Paginação nas listagens          | 🟡 infraestrutura      | `PaginatedSchema`, `<Pagination>` component prontos; endpoints TBD  |
| God-components <300 linhas       | 🟡 débito              | DEBT #15: scheduler-view (487), pipeline-view (458), harness (412)  |
| Zero lint errors                 | 🟡 débito              | DEBT #16: max-lines-per-function nos god-components acima            |
