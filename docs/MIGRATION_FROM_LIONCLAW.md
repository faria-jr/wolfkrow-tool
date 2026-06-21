# Migrating from LionClaw to Wolfkrow

This guide walks through migrating your data from LionClaw v3.0 to Wolfkrow.

## What migrates automatically

| LionClaw table | Wolfkrow table | Notes |
|---|---|---|
| `users` | `users` | All user accounts |
| `agents` | `agents` | Agent configurations |
| `chat_sessions` | `chat_sessions` | Conversation sessions |
| `chat_messages` | `chat_messages` | Full message history |
| `knowledge_documents` | `knowledge_documents` | Document index |
| `knowledge_chunks` | `knowledge_chunks` | Chunked knowledge |
| `memory` | `semantic_memories` | Long-term memories |
| `secrets` | `vault_secrets` | Keys are migrated; values must be re-entered (security) |
| `mcp_servers` | `mcp_servers` | MCP server configs |
| `scheduled_tasks` | `scheduled_tasks` | Cron tasks |

> **Vault values**: Secret values and encrypted payloads are intentionally skipped during migration. After migrating, re-enter API keys via **Settings → Vault**.

## Prerequisites

- LionClaw v3.0 installed (or a `.db` file from a LionClaw backup)
- Wolfkrow installed and configured (run `wolfkrow` at least once to initialize the DB)
- Node.js 22+

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

## Troubleshooting

**"LionClaw DB not found"**: Pass the correct path with `--from`. You can also export from LionClaw via _Settings → Export → SQLite backup_.

**"Table not found in source"**: LionClaw version mismatch. The migrator requires LionClaw v3.0+.

**"Schema mismatch"**: The migrator applies column-level mapping and can handle minor schema drift. If you see this error, open an issue with your LionClaw version.

**Rollback fails**: If the backup file was deleted, recover from a Time Machine or system backup. The Wolfkrow DB is at `.wolfkrow/data/wolfkrow.db`.
