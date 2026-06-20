# ADR-0004: Drizzle ORM para SQLite

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 usa `better-sqlite3` com raw SQL em `db.ts` (5598 linhas). Problemas:

1. **Type safety zero**: SQL concatenado com strings, erros só em runtime
2. **God object**: `db.ts` mistura schema, migrations (78!), CRUD, business logic
3. **Difícil de testar**: queries raw SQL não são mockable facilmente
4. **Migrations manuais**: 29 arquivos `v50-v78.ts` aplicados sequencialmente em runtime
5. **Refactor arriscado**: mudar schema = reescrever 78 migrations

## Decisão

**Drizzle ORM** + **better-sqlite3** + **drizzle-kit** para migrations.

```typescript
// packages/infra/src/db/schema/agents.ts
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  model: text('model').notNull(),
  // ...
});

// packages/infra/src/repos/drizzle-agent-repo.ts
export class DrizzleAgentRepo implements AgentRepo {
  constructor(private db: Database) {}
  
  async findById(id: string): Promise<Agent | null> {
    const row = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);
    
    return row[0] ? Agent.fromRow(row[0]) : null;
  }
  
  async save(agent: Agent): Promise<void> {
    await this.db
      .insert(agents)
      .values(agent.toRow())
      .onConflictDoUpdate({ target: agents.id, set: agent.toRow() });
  }
}
```

Migrations geradas automaticamente:
```bash
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate     # apply migrations
pnpm db:studio      # visual DB browser
```

## Consequências

### Positivas

- **Type safety**: queries são type-checked em build time
- **Auto-complete**: IDE sugere columns
- **Migrations auto-geradas**: `drizzle-kit generate` cria SQL a partir de schema
- **Zero overhead**: Drizzle gera SQL puro, sem ORM intermediário
- **Composable**: query builder permite queries complexas
- **Lightweight**: ~10KB runtime
- **sqlite-vec integration**: suporte nativo para vector search

### Negativas

- **Vendor lock-in parcial**: trocar ORM é refactor médio
- **Less features**: não tem `findOrCreate`, `softDelete` (precisamos implementar)
- **Learning curve**: devs precisam aprender query builder

### Mitigações

- Repository pattern isola Drizzle (trocar = criar novo adapter)
- Helpers em domain layer para padrões comuns
- Documentação em `AGENT.md`

## Alternativas Consideradas

### A. Prisma

**Prós**: Mais maduro, mais features (Prisma Studio), melhor DX
**Contras**: Runtime próprio (~5MB), binary engine, menos type-safety puro (DSL)
**Decisão**: ❌ Rejeitado — Drizzle é mais leve e type-safe

### B. TypeORM

**Prós**: Maduro, decorator-based, familiar para devs Java/.NET
**Contras**: Pesado, decorators + reflection, performance issues
**Decisão**: ❌ Rejeitado — Drizzle é mais moderno

### C. Kysely

**Prós**: Type-safe query builder puro, leve
**Contras**: Sem migrations built-in (precisaria kysely-migrations)
**Decisão**: ❌ Rejeitado — Drizzle tem migrations integradas

### D. Raw SQL + Knex migrations

**Prós**: Controle total
**Contras**: Sem type safety, boilerplate, god objects
**Decisão**: ❌ Rejeitado — é o que temos hoje e queremos melhorar

### E. Drizzle + raw SQL escape hatch

**Prós**: Melhor dos dois mundos
**Contras**: Consistência fica difícil
**Decisão**: ✅ Aceito — Drizzle permite `sql` template tag para raw quando necessário

## Schema Strategy

### 1. Schema First

Schema definido em `packages/infra/src/db/schema/` → Migrations geradas automaticamente.

### 2. Domain Entities como Single Source of Truth (parcialmente)

Domain entities (`packages/domain/src/entities/agent.ts`) definem **regras de negócio**.
Schema Drizzle (`packages/infra/src/db/schema/agents.ts`) define **estrutura**.

Mapping: `Agent.fromRow(row)` e `agent.toRow()` conectam ambos.

### 3. Migrations Versionadas

`packages/infra/drizzle/` com migrations auto-geradas. Nunca editadas manualmente.

```bash
drizzle/
├── 0000_initial.sql
├── 0001_add_harness_metrics.sql
├── 0002_add_pipeline_phases.sql
└── meta/
    └── _journal.json
```

## Padrões de Repository

```typescript
// 1. Domain interface (port)
export interface AgentRepo {
  findById(id: string): Promise<Agent | null>;
  list(filter?: AgentFilter): Promise<Agent[]>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
}

// 2. Drizzle implementation (adapter)
export class DrizzleAgentRepo implements AgentRepo {
  constructor(private db: Database) {}
  // ...
}

// 3. In-memory implementation (tests)
export class InMemoryAgentRepo implements AgentRepo {
  private agents = new Map<string, Agent>();
  // ...
}
```

## SQLite Specifics

```typescript
// WAL mode (concorrência read/write)
db.pragma('journal_mode = WAL');

// Foreign keys
db.pragma('foreign_keys = ON');

// Busy timeout
db.pragma('busy_timeout = 5000');

// Vector search (sqlite-vec)
db.loadExtension(sqliteVec);
```

## References

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
