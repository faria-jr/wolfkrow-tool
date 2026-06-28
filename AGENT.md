# AGENT.md — Guia para Agentes de IA

> Este arquivo documenta a arquitetura, convenções e padrões do Wolfkrow Tool para que agentes de IA (Claude Code, Cursor, etc) possam trabalhar no projeto com máxima eficácia.

## Quick Context

Wolfkrow Tool é um assistente pessoal de IA self-hosted, single-user, single-machine. Stack principal: Next.js 15 fullstack (frontend + API gateway) + Worker Node.js separado (background tasks) + SQLite local. Refactor do LionClaw v3 aplicando Clean Architecture, TDD, Clean Code, SOLID, DRY.

**Regra de ouro**: Antes de editar qualquer arquivo, leia-o inteiro. Antes de criar arquivo novo, verifique se já existe algo similar. Antes de propor mudança arquitetural, leia o ADR correspondente em `docs/adr/`.

## Estrutura do Monorepo

```
wolfkrow-tool/
├── apps/
│   ├── web/                # Next.js 15 (frontend + API gateway)
│   ├── worker/             # Node.js (MCPs, Telegram, scheduler, voice)
│   ├── sidecar/            # Open Design Studio (Next.js independente)
│   └── wrapper/            # Electron mínimo (systray + hotkey)
├── packages/
│   ├── shared-types/       # Zod schemas (single source of truth)
│   ├── domain/             # Entities + Value Objects + Services
│   ├── use-cases/          # Application services (Clean Arch)
│   ├── infra/              # DB + repos + AI providers + external
│   ├── ipc-contract/       # Type-safe Web ↔ Worker bridge
│   ├── design-tokens/      # Tokens compartilhados (Tailwind config)
│   └── mcp-servers/        # 19 MCP packages
├── docs/                   # PRD, ADRs, SPECs, plano
├── .wolfkrow/              # Estado persistente (gitignored)
└── resources/              # whisper.cpp, ffmpeg, icons
```

## Padrões Arquiteturais

### Clean Architecture (4 camadas)

```
Presentation (Next.js + React)
    ↓
Application (Use Cases)
    ↓
Domain (Entities + Services) ← puro, zero deps externas
    ↑
Infrastructure (DB + repos + AI providers)
```

**Regras**:

- `domain/` não importa nada de outros layers
- `use-cases/` importa apenas `domain/`
- `infra/` importa `domain/` + `use-cases/`
- `apps/web/` importa `domain/` + `use-cases/` + `infra/` (apenas client-safe)
- `apps/worker/` importa tudo

### Strategy Pattern para AI Providers

4 SDKs diferentes, 1 interface:

```typescript
// packages/domain/src/services/AIProvider.ts
export interface AIProvider {
  readonly id: string;
  query(prompt: Prompt, options: QueryOptions): AsyncIterable<StreamChunk>;
  countTokens(text: string): number;
}
```

Implementações: `ClaudeProvider`, `CodexProvider`, `LionProvider`, `OpenAICompatProvider`. Adicionar novo SDK = criar nova implementação.

### Repository Pattern para DB

```typescript
// packages/domain/src/repos/AgentRepo.ts (interface)
export interface AgentRepo {
  findById(id: string): Promise<Agent | null>;
  list(filter?: AgentFilter): Promise<Agent[]>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
}

// packages/infra/src/repos/DrizzleAgentRepo.ts (impl)
export class DrizzleAgentRepo implements AgentRepo { ... }

// packages/infra/src/repos/InMemoryAgentRepo.ts (testes)
export class InMemoryAgentRepo implements AgentRepo { ... }
```

### Zod como Single Source of Truth

**Todos os tipos são inferidos de Zod schemas**:

```typescript
// packages/shared-types/src/schemas/agent.ts
export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  model: z.string(),
  effort: z.enum(['low', 'medium', 'high', 'max']),
  // ...
});

export type Agent = z.infer<typeof AgentSchema>;
```

Schemas Zod são usados para:

1. Validação runtime (Route Handlers, IPC)
2. Inferência de tipos TypeScript
3. Documentação OpenAPI (gerada automaticamente)
4. Migrations Drizzle (schema derivado)
5. Seed agents YAML (validação ao carregar)

## Convenções de Código

### TypeScript Strict Mode

`tsconfig.base.json` tem:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noImplicitAny: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `exactOptionalPropertyTypes: true`
- `noFallthroughCasesInSwitch: true`

**Nunca** use `any`. Use `unknown` + type guards.

### Naming

- **Files**: kebab-case (`agent-repo.ts`, `send-message.ts`)
- **Classes**: PascalCase (`AgentRepo`, `SendMessage`)
- **Functions/vars**: camelCase (`createAgent`, `sessionId`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TURNS = 80`)
- **Types**: PascalCase (`Agent`, `StreamChunk`)
- **React components**: PascalCase (`ChatPage`, `Sidebar`)
- **Database tables**: snake_case (`agents`, `chat_messages`)

### Funções

- Max 50 linhas (ESLint enforced)
- Max 4 parâmetros (ESLint enforced)
- Max cyclomatic complexity 10
- Max nesting depth 3
- Use early return (`if (!valid) return error;`)
- Pure functions preferidas em domain/application
- Async/await, não `.then()` chains
- Sempre retorne tipos explícitos em public APIs

### Imports

Ordem alfabético com newlines entre grupos:

```typescript
// External
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// Internal (packages)
import { Agent } from '@wolfkrow/domain/entities/agent';
import { AgentRepo } from '@wolfkrow/domain/repos/agent-repo';

// Internal (relative)
import { container } from './di-container';
import { logger } from './logger';

// Types
import type { SendMessageInput } from '@wolfkrow/shared-types/schemas/chat';
```

Path aliases:

- `@wolfkrow/*` → `packages/*`
- `@web/*` → `apps/web/*`
- `@worker/*` → `apps/worker/*`

### Error Handling

- Erros tipados, não strings: `throw new AgentNotFoundError(id)` em vez de `throw 'agent not found'`
- Domain errors herdam de `DomainError`
- Application errors herdam de `ApplicationError`
- Infrastructure errors herdam de `InfrastructureError`
- Sempre log via Pino: `logger.error({ err, context }, 'failed to save agent')`
- Nunca swallow errors silently

### IPC e Streaming

- **HTTP REST**: mutations simples (CRUD padrão)
- **Server Actions**: mutations de UI (com optimistic update)
- **SSE**: streaming unidirecional (chat, pipeline, harness, logs)
- **WebSocket**: bidirectional (PTY terminal)

**Validação**: TODOS os payloads IPC passam por Zod validation no servidor.

### Tests (TDD)

**Workflow**: RED → GREEN → REFACTOR.

1. **RED**: Escrever teste que falha
2. **GREEN**: Implementar mínimo para passar
3. **REFACTOR**: Melhorar sem quebrar testes
4. **REVIEW**: PR com coverage check

**Coverage targets**:

- `packages/domain/`: ≥95%
- `packages/use-cases/`: ≥90%
- `packages/infra/repos/`: ≥85%
- `packages/infra/ai-providers/`: ≥85%
- `apps/web/components/`: ≥70% (≥80% para forms/auth)
- `apps/worker/`: ≥85%

**Estrutura**:

```
src/
├── entities/
│   ├── agent.ts
│   └── __tests__/
│       └── agent.test.ts
└── use-cases/
    ├── send-message.ts
    └── __tests__/
        └── send-message.test.ts
```

**Frameworks**:

- `vitest` para unit + integration
- `@testing-library/react` para components
- `playwright` para E2E
- MSW (Mock Service Worker) para mock de APIs

## Banco de Dados

**Engine**: better-sqlite3 + sqlite-vec (vector search)
**ORM**: Drizzle ORM (type-safe, leve)
**Localização**: `.wolfkrow/data/wolfkrow.db`
**Mode**: WAL (concorrência read/write)
**Migrations**: `drizzle-kit generate` (auto-geradas)

```typescript
// packages/infra/src/db/schema/agents.ts
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ...
});
```

**SEMPRE** use prepared statements (Drizzle gera automaticamente).
**NUNCA** concatene SQL manualmente.
**NUNCA** use `any` em queries — tipos são inferidos.

## Comunicação Next.js ↔ Worker

```typescript
// Next.js Route Handler
export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await requireSession();

  // SSE streaming from Worker
  return new Response(
    new ReadableStream({
      async start(controller) {
        await forwardToWorker('/chat/send', body, (chunk) => {
          controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        });
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  );
}
```

Worker expõe HTTP em `http://localhost:4000`. Next.js faz proxy.

## Seed Agents

**Formato**: YAML em `.wolfkrow/agents/<name>.yaml`

```yaml
# .wolfkrow/agents/code-reviewer.yaml
name: code-reviewer
description: Reviews code changes and provides feedback
model: claude-sonnet-4-5
effort: high
thinking: true
thinkingBudget: 10000
maxTurns: 80
allowedTools:
  - Read
  - Grep
  - Glob
runtime: cloud
squad: harness
systemPrompt: |
  You are a senior code reviewer.
  Focus on security, performance, and maintainability.
  ...
```

**Loader** valida com Zod schema no boot.

## Conventional Commits

```bash
feat: add voice conversation panel
fix: resolve SSE reconnection bug
docs: update ADR-001 with rationale
refactor: extract AIProvider strategy pattern
test: add unit tests for AgentRepo
chore: update dependencies
```

## Não Fazer

- ❌ **NÃO** use `any` — use `unknown` + type guards
- ❌ **NÃO** concatene SQL — use Drizzle
- ❌ **NÃO** exponha Node.js APIs ao browser (apenas via Route Handlers)
- ❌ **NÃO** armazene secrets em plaintext — sempre keytar
- ❌ **NÃO** crie god objects (max 50 linhas por função)
- ❌ **NÃO** use `localStorage` para dados sensíveis
- ❌ **NÃO** use em-dashes (—) em copy de UI ou comentários
- ❌ **NÃO** mencione outros agents em seed agent system prompts (isolation rule)
- ❌ **NÃO** commite `.env`, `node_modules/`, `dist/`, `.wolfkrow/data/`

## Onboarding para Novos Agentes

1. Ler este arquivo inteiro
2. Ler `docs/PRD.md` para entender o produto
3. Ler `docs/ARCHITECTURE.md` para entender a arquitetura
4. Ler ADRs relevantes para área de trabalho
5. Verificar SPECs das features em desenvolvimento
6. Rodar `pnpm install && pnpm turbo build` para validar setup (requer Node 24+, pnpm 9+)
7. Rodar `pnpm test` para validar testes existentes
8. Escolher uma issue/tarefa e seguir TDD

## Useful Commands

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Tests
pnpm test                    # Unit + integration
pnpm test:watch              # Watch mode
pnpm test:cov                # With coverage
pnpm test:e2e                # Playwright E2E

# Build
pnpm build                   # Build all
pnpm turbo build --filter=web # Build specific package

# Dev
pnpm dev                     # All apps
pnpm dev:web                 # Just web
pnpm dev:worker              # Just worker

# Database
pnpm db:generate             # Generate Drizzle migrations
pnpm db:migrate              # Apply migrations
pnpm db:studio               # Open Drizzle Studio (visual DB browser)
```

## Links Úteis

- [PRD.md](./docs/PRD.md)
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)
- [ADR-0001: Next.js 15 como renderer](./docs/adr/0001-use-nextjs-15.md)
- [Clean Architecture original](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## Contato

- Repo: github.com/wolfkrow-labs/wolfkrow-tool
- Issues: github.com/wolfkrow-labs/wolfkrow-tool/issues
- Discord: (em breve)
