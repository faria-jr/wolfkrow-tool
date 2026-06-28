# ADR-0016: better-sqlite3 como Database Engine

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool precisa de database local para 40+ tables com:

- ACID transactions
- Type-safe queries
- Vector search (embeddings)
- Performance (sub-millisecond queries)
- Single-process (single-user)
- Zero ops (no server to manage)

Opções:

1. **better-sqlite3** (síncrono, rápido, embedded)
2. **node-sqlite3** (async, callback-based)
3. **PostgreSQL** (server, requires install)
4. **LibSQL / Turso** (cloud, fork do SQLite)
5. **PouchDB** (NoSQL, JSON)

## Decisão

**better-sqlite3** + **sqlite-vec** (vector search extension).

```typescript
// packages/infra/src/db/client.ts
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { resolveWolfkrowHome } from '@wolfkrow/infra/paths';

const dbPath = `${resolveWolfkrowHome()}/data/wolfkrow.db`;
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
sqlite.loadExtension(sqliteVec);

export const db = drizzle(sqlite, { schema });
```

## Consequências

### Positivas

- **Embedded**: zero ops, zero config
- **Fast**: mais rápido que Postgres para single-user workloads
- **Sync API**: mais simples que async (com worker_threads se precisar paralelismo)
- **ACID**: transactions completas
- **Battle-tested**: usado por Notion, Apple, etc
- **Cross-platform**: macOS, Windows, Linux
- **sqlite-vec**: vector search nativo (similarity)
- **WAL mode**: concorrência read/write

### Negativas

- **Single-machine**: sem replicação (single-user, OK)
- **No horizontal scaling**: limitação para multi-user (não é nosso caso)
- **File-based**: precisa backup manual
- **Native module**: rebuild para Electron/Node.js

### Mitigações

- Backup script (cron + opt-in cloud sync futuro)
- Native rebuild via `electron-rebuild` ou `pnpm rebuild`

## WAL Mode (Concurrency)

```sql
PRAGMA journal_mode = WAL;  -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;  -- Balance performance/durability
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;  -- 5s wait if locked
```

**Benefit**: Múltiplas leituras simultâneas + 1 escrita.

## Vector Search (sqlite-vec)

```typescript
// Knowledge chunks table
import { sql } from 'drizzle-orm';
import { vec_f32 } from '@wolfkrow/infra/db/sqlite-vec';

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  content: text('content').notNull(),
  embedding: vec_f32('embedding', { dimensions: 1024 }), // Voyage embeddings (voyage-3) — ver ADR-0028
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
});

// Search
const results = await db
  .select({
    id: knowledgeChunks.id,
    content: knowledgeChunks.content,
    distance: sql<number>`vec_distance_cosine(${knowledgeChunks.embedding}, ${queryEmbedding})`,
  })
  .from(knowledgeChunks)
  .orderBy(sql`distance`)
  .limit(10);
```

## Schema Management (Drizzle)

```typescript
// packages/infra/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.wolfkrow/data/wolfkrow.db',
  },
  verbose: true,
  strict: true,
});
```

```bash
pnpm db:generate    # Generate migration from schema diff
pnpm db:migrate     # Apply pending migrations
pnpm db:studio      # Visual DB browser
```

## Backup Strategy

```typescript
// scripts/backup-db.ts
import { copyFile } from 'fs/promises';
import { resolveWolfkrowHome } from '@wolfkrow/infra/paths';

async function backup() {
  const dbPath = `${resolveWolfkrowHome()}/data/wolfkrow.db`;
  const backupPath = `${dbPath}.backup-${Date.now()}`;

  // SQLite-safe backup (uses backup API)
  await db.backup(backupPath);

  // Compress + upload (opt-in)
  if (process.env.WOLFKROW_BACKUP_CLOUD) {
    await uploadToCloud(backupPath);
  }
}
```

## Performance

Benchmarks (1M rows, indexed query):

- **Read**: <1ms
- **Write**: ~5ms (with WAL)
- **Vector search (10k chunks)**: ~50ms
- **Transaction**: <10ms

Suficiente para single-user workloads.

## Alternativas Consideradas

### A. node-sqlite3 (async)

**Prós**: Async API
**Contras**: Mais lento, callback hell
**Decisão**: ❌ Rejeitado — better-sqlite3 é superior

### B. PostgreSQL

**Prós**: Maduro, features avançadas
**Contras**: Requer server, setup, ops
**Decisão**: ❌ Rejeitado — single-user não precisa

### C. LibSQL / Turso

**Prós**: SQLite fork com sync cloud
**Contras**: Requer cloud account
**Decisão**: 🤔 Considerado para cloud sync em v2.0

### D. PouchDB (NoSQL)

**Prós**: Sync built-in
**Contras**: Sem relational queries, sem vector search
**Decisão**: ❌ Rejeitado — não atende requisitos

### E. DuckDB

**Prós**: OLAP rápido
**Contras**: Overkill para OLTP
**Decisão**: ❌ Rejeitado

## References

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [Drizzle SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
