# Wolfkrow-Tool — MVP Final Plan (MINIMAX)

> **Versão:** 1.0
> **Data:** 2026-06-27
> **Status:** Pronto para execução
> **Origem:** Auditoria completa wolfkrow-tool vs lionclawv1.0 + análise de 22 specs + 33 ADRs + 4 docs principais
> **Modelo:** MINIMAX
> **Escopo:** Tornar o wolfkrow-tool funcionalmente par (ou superior) ao lionclaw, eliminando débitos técnicos, bugs críticos e gaps de features.

---

## 0. Sumário Executivo

### 0.1 Estado Atual (Auditado 2026-06-27)

| Dimensão                                 | Status                                                               |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Paridade funcional vs lionclaw           | **~88%** (6 features gap, 8 não-portadas)                            |
| Bugs BLOCKER/CRITICAL                    | **6** (chat keychain, knowledge upload, auth-bypass 3x, type-safety) |
| Cobertura testes `packages/infra`        | **72.18%** (PRD ≥85% — gap 12.82pp)                                  |
| E2E domínios cobertos                    | 3 de 12 ❌                                                           |
| Conformidade Clean Architecture          | 88/100 (vazamentos presentation)                                     |
| Code Quality (DRY/SOLID/YAGNI)           | Bom no core; 4 padrões DRY 20-30x duplicados                         |
| TODOs/FIXMEs/any/@ts-ignore              | **0** (excelente)                                                    |
| Funcionalidades não-portadas do lionclaw | 8 (6 gaps reais + 2 deferidas)                                       |
| Paginação                                | ❌ Falta em quase todas as listagens                                 |
| Bloqueio por usuário                     | ❌ Default é bloqueante (shared-workspace)                           |

### 0.2 Escopo do MVP Final

**Obrigatório (Must-have):**

- ✅ Corrigir **6 bugs BLOCKER/CRITICAL** que impedem uso real
- ✅ Implementar **6 features gap** do lionclaw (cadastro projetos, HITL chat, timeline, etc)
- ✅ Adicionar **paginação** em todas as páginas e endpoints
- ✅ **Remover bloqueios por usuário** (shared-workspace = false default)
- ✅ Garantir **paridade visual** com lionclaw (layout, componentes, polish)
- ✅ Subir cobertura `packages/infra` para **≥85%** (PRD compliance)
- ✅ Adicionar **9 specs E2E** faltantes (agents, skills, mcp, scheduler, rules, knowledge, memory, harness, pipeline)

**Desejável (Should-have):**

- 🟡 Redesenhar layout Harness/Pipeline com timeline + HITL
- 🟡 Polir cadastro de agents (ordem dos campos + MarkdownEditor inline)
- 🟡 Implementar edição de providers (id locked em edit mode)
- 🟡 Implementar edição de skills (qualquer skill bundled)
- 🟡 Implementar configuração de channels (Telegram + Discord/Slack placeholders)

**Fora do escopo (deferido v1.1+):**

- ⛔ Auto-execução AI do Harness (Planner→Coder→Evaluator) — v1.1 (FEATURE_MATRIX aceita)
- ⛔ AskUserQuestion interativo — v1.1 (P0-3 aceita)
- ⛔ Excalidraw inline no chat — v1.1 (FEATURE_MATRIX aceita)
- ⛔ Audit log filtros avançados — v1.1 (FEATURE_MATRIX aceita)
- ⛔ Multi-user isolation — v1.0 é single-user (PRD aceita)
- ⛔ Higgsfield/Blotato MCPs — v2 (ADR-0031 aceita)
- ⛔ mgraph structured vault — v1.0 (ADR-0033 aceita)
- ⛔ Knowledge benchmark — removido (ADR-0032 aceita)

### 0.3 Estimativa de Esforço

| Fase                                                      | Esforço         | Duração                          |
| --------------------------------------------------------- | --------------- | -------------------------------- |
| Fase 0 — Bug fixes BLOCKER/CRITICAL                       | 0.5 dev-day     | 1 dia                            |
| Fase 1 — Quality + Architecture (Clean-up)                | 3 dev-days      | 3 dias                           |
| Fase 2 — Features gap (cadastro projetos, HITL, timeline) | 5 dev-days      | 5 dias                           |
| Fase 3 — Paginação + Remoção bloqueios usuário            | 1 dev-day       | 1 dia                            |
| Fase 4 — Cobertura de testes (`packages/infra` 72→85%)    | 2 dev-days      | 2 dias                           |
| Fase 5 — E2E specs (9 specs faltantes)                    | 3 dev-days      | 3 dias                           |
| Fase 6 — Layout/UX polish (Harness, Pipeline, Sidebar)    | 4 dev-days      | 4 dias                           |
| Fase 7 — Auditoria final + validação                      | 1 dev-day       | 1 dia                            |
| **TOTAL**                                                 | **20 dev-days** | **~4 semanas (1 dev full-time)** |

### 0.4 Critérios de Done (Definition of Done — PRD §10)

Para cada item do MVP ser considerado "Done":

- [ ] Spec/clareza da implementação documentada
- [ ] Testes escritos ANTES (TDD) e passando (≥85% backend, ≥70% frontend, ≥85% infra)
- [ ] Implementação completa (sem TODOs, sem FIXMEs, sem `void` placeholders)
- [ ] `pnpm typecheck` passa
- [ ] `pnpm lint` passa (sem novos errors/warnings)
- [ ] Manual testing em Chrome/Edge/Firefox
- [ ] Sem bugs conhecidos
- [ ] Sem débitos técnicos
- [ ] Integração backend↔frontend funcional e correta
- [ ] Layout moderno, minimalista, impactante, com excelente usabilidade
- [ ] Auditoria final aprovada (ver Fase 7)

---

## 1. Arquitetura-Alvo (Target State)

### 1.1 Camadas (sem mudança — validar enforcement)

```
┌──────────────────────────────────────────────────────────┐
│ BROWSER (Next.js 15 — apps/web)                          │
│  - React 19, RSC + Client Components (90% RSC)           │
│  - shadcn/ui + Tailwind v4                               │
│  - Zustand (UI state) + TanStack Query (server state)    │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP / SSE / WebSocket
┌──────────────────▼───────────────────────────────────────┐
│ NEXT.JS 15 ROUTE HANDLERS (Node.js — apps/web)            │
│  - getSession() em TODOS os handlers                     │
│  - Zod validation no boundary (parseJsonBody helper)     │
│  - Proxy para worker (com Authorization)                 │
│  - Sem import direto de @wolfkrow/infra (ESLint guard)   │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP / WebSocket (auth: JWT Bearer)
┌──────────────────▼───────────────────────────────────────┐
│ WORKER (Fastify — apps/worker)                            │
│  - DI via container.ts (NUNCA new XxxRepo())             │
│  - Domain errors → HTTP status (NotFound→404, etc)       │
│  - Single SERVICE='wolfkrow' para keychain               │
│  - /sidecar/*, /audit/*, /profiler/* com auth preHandler │
└──────────────────┬───────────────────────────────────────┘
                   │
       ┌───────────┼───────────┬──────────────┐
       ▼           ▼           ▼              ▼
   ┌───────┐  ┌────────┐  ┌────────┐  ┌──────────┐
   │ domain│  │use-cases│  │ infra  │  │shared-types│
   │ (pure)│  │(ports)  │  │(adapters)│  │(constants)│
   └───────┘  └────────┘  └────────┘  └──────────┘
       ▲           ▲           ▲              ▲
       │           │           │              │
       └───────────┴───────────┴──────────────┘
              ZERO acoplamento presentation↔infra
```

### 1.2 Estado-Alvo dos Pacotes

| Pacote                  | Antes                         | Depois                                | Mudança                          |
| ----------------------- | ----------------------------- | ------------------------------------- | -------------------------------- |
| `packages/domain`       | 97.97% cov, 0 deps            | 97.97% cov, 0 deps                    | Manter                           |
| `packages/use-cases`    | 93.98% cov, 50+ sem teste     | 95% cov, ≥1 teste/use case            | Adicionar testes                 |
| `packages/infra`        | 72.18% cov ❌                 | **85% cov** ✅                        | Adicionar testes (5 arquivos 0%) |
| `packages/shared-types` | 17 erros paralelos            | Seeds movidos daqui; errors em domain | Consolidar                       |
| `apps/web`              | 80.21% cov, 24 grupos         | 85% cov, layout polido                | Paginar + polish                 |
| `apps/worker`           | 85.78% cov, 9 routes sem auth | 90% cov, 0 routes sem auth            | Auth + testes                    |
| `apps/sidecar`          | 95% cov                       | 95% cov                               | Manter                           |
| `apps/wrapper`          | OK                            | OK                                    | Manter                           |

### 1.3 Estado-Alvo da FEATURE_MATRIX

| Status              | Antes    | Depois                                     |
| ------------------- | -------- | ------------------------------------------ |
| ✅ Feito            | 48/55    | **55/55** (eliminar 🟡 e ⛔ não-deferidos) |
| 🟡 Parcial          | 4        | 0 (v1.1 é v1.1)                            |
| ⛔ v1.1+            | 5        | 5 (mantém deferidos documentados)          |
| **Cobertura total** | **~93%** | **100%** das features não-deferidas        |

### 1.4 Estado-Alvo de Segurança

- ✅ Zero auth-bypass em routes web/worker
- ✅ Single keychain SERVICE (`'wolfkrow'`)
- ✅ `validateProjectPath` em todas as routes que aceitam path
- ✅ `secure: NODE_ENV === 'production'` em cookies
- ✅ ESLint `no-restricted-imports` para boundaries de camada
- ✅ Rate limit com cleanup automático (Map TTL)
- ✅ Vault IDOR corrigido (userId em todas as queries)

---

## 2. Fase 0 — Bug Fixes BLOCKER & CRITICAL (P0 — 0.5 dev-day)

> **Objetivo:** Tornar o sistema utilizável. Sem essas correções, o MVP não pode ser testado.

### 2.1 B1 — Keychain SERVICE mismatch (BLOCKER)

**Root cause do erro reportado:**

```log
[worker] {"err":{"message":"Missing API key in keychain: wolfkrow/zai-api-key"}}
```

Há TRÊS fontes de verdade para o `service` name do keytar:

1. `apps/worker/src/lib/keychain.ts:3` → `KEYTAR_SERVICE = 'wolfkrow'` (lido em `getProviderApiKey`)
2. `packages/infra/src/secrets/keytar-adapter.ts:4` → `SERVICE = 'wolfkrow-tool'` (escrito por toda UI)
3. `packages/infra/src/auth/keypair-store.ts:15` → `SERVICE = 'wolfkrow'` (correto, para JWT keypair)

**Quando o usuário adiciona Z.ai key via web UI:**

- `POST /api/providers` → `KeytarSecretsAdapter.set` grava em `wolfkrow-tool/zai-api-key` ✓

**Quando o worker tenta usar:**

- `orchestrator.loadApiKey` (`orchestrator.ts:203-205`) chama direto `getProviderApiKey(provider, 'wolfkrow')` → procura em `wolfkrow/zai-api-key` → null → **throw** ❌

**Correção:**

**Arquivo 1:** Criar `packages/infra/src/secrets/keytar-service.ts` (single source of truth):

```typescript
// packages/infra/src/secrets/keytar-service.ts
export const KEYTAR_SERVICE = 'wolfkrow';
export const VAULT_SERVICE = 'wolfkrow'; // unificado (era 'wolfkrow-tool')
```

**Arquivo 2:** Atualizar `packages/infra/src/secrets/keytar-adapter.ts:4`:

```diff
- const SERVICE = 'wolfkrow-tool';
+ import { KEYTAR_SERVICE } from './keytar-service';
+ const SERVICE = KEYTAR_SERVICE;
```

**Arquivo 3:** Refatorar `apps/worker/src/orchestrator.ts:203-205` para SEMPRE tentar `secrets.get()` antes de `getProviderApiKey()`:

```typescript
private async loadApiKey(provider: string, cfg?: ProviderConfig): Promise<string> {
  if (cfg?.apiKeyAccount) {
    const stored = await getAdapters().secrets.get(cfg.apiKeyAccount);
    if (stored) return stored;
  }
  // Fallback para chaves legadas (provider name → account map)
  return getProviderApiKey(provider, this.keytarService);
}
```

**Arquivo 4:** Atualizar `apps/worker/src/lib/keychain.ts:3`:

```diff
- export const KEYTAR_SERVICE = 'wolfkrow';
+ import { KEYTAR_SERVICE } from '@wolfkrow/infra/secrets/keytar-service';
+ // re-exported for backward compat
```

**Critérios de aceitação:**

- [ ] `pnpm test apps/worker/src/__tests__/orchestrator.test.ts` passa com novo teste de resolution Z.ai
- [ ] Manual test: adicionar Z.ai key via UI → chat com modelo `glm-4.7` funciona sem erro
- [ ] Teste E2E: `apps/web/e2e/chat-with-claude-compat.spec.ts` (novo) passa

---

### 2.2 B2 — Knowledge upload 401 (CRITICAL)

**Root cause:** `apps/web/app/api/knowledge/upload/route.ts:22` usa `(session as any).token` que não existe em `SessionPayload`.

**Correção:**

**Arquivo:** `apps/web/app/api/knowledge/upload/route.ts`

```diff
+ import { cookies } from 'next/headers';
  ...
- const authToken = (session as unknown as { token: string }).token;
- headers['Authorization'] = `Bearer ${authToken}`;
+ const sessionToken = (await cookies()).get('session')?.value;
+ if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
+ const cookieHeader = request.headers.get('cookie');
+ if (cookieHeader) headers['Cookie'] = cookieHeader;
```

**Critérios:**

- [ ] Upload de PDF via `/knowledge` page funciona end-to-end
- [ ] Teste E2E: `apps/web/e2e/knowledge-upload.spec.ts` (novo) passa

---

### 2.3 B3 — Auth-bypass em audit/profiler/permissions (CRITICAL)

**4 rotas web NÃO chamam `getSession()`:**

1. `apps/web/app/api/audit/route.ts` (POST + GET)
2. `apps/web/app/api/profiler/route.ts` (POST)
3. `apps/web/app/api/permissions/audit/route.ts`
4. `apps/web/app/api/permissions/decisions/route.ts`

**Correção:** Padronizar helper único em `apps/web/lib/auth.ts`:

```typescript
// apps/web/lib/auth.ts (novo)
export async function requireSession(request: Request): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

// Helper para construir headers com auth
export async function getAuthHeaders(request: Request): Promise<Record<string, string>> {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = (await cookies()).get('session')?.value;
  return {
    'Content-Type': 'application/json',
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}
```

**Aplicar em todas as 4 rotas:**

```typescript
// Exemplo: apps/web/app/api/audit/route.ts
- async function proxy(request: Request, path: string): Promise<NextResponse> {
-   const url = `${WORKER_URL}${path}`;
-   const headers: Record<string, string> = { 'Content-Type': 'application/json' };
-   const authHeader = request.headers.get('authorization');
-   if (authHeader) headers['Authorization'] = authHeader;
+ async function proxy(request: Request, path: string): Promise<NextResponse> {
+   const session = await requireSession(request);
+   if (session instanceof NextResponse) return session;
+   const url = `${WORKER_URL}${path}`;
+   const headers = await getAuthHeaders(request);
```

**Critérios:**

- [ ] Chamada anônima para `/api/audit/run` retorna 401
- [ ] Chamada autenticada funciona
- [ ] Teste em `apps/web/app/api/audit/__tests__/` (novo) cobre 401 + 200 paths

---

### 2.4 B4 — Sidecar sem auth no worker (CRITICAL)

**Root cause:** `apps/worker/src/routes/sidecar.ts:13-26` não tem `preHandler: [server.authenticate]`.

**Correção:**

**Arquivo:** `apps/worker/src/routes/sidecar.ts`

```diff
- export default async function sidecarRoutes(server: FastifyInstance) {
+ export default async function sidecarRoutes(server: FastifyInstance) {
+   const auth = { onRequest: [server.authenticate] };

-   server.post('/sidecar/start', async (req, reply) => { ... });
-   server.post('/sidecar/stop', async (req, reply) => { ... });
-   server.get('/sidecar/status', async (req, reply) => { ... });
+   server.post('/sidecar/start', { ...auth }, async (req, reply) => { ... });
+   server.post('/sidecar/stop', { ...auth }, async (req, reply) => { ... });
+   server.get('/sidecar/status', { ...auth }, async (req, reply) => { ... });
```

**Arquivo:** `apps/web/app/api/sidecar/route.ts:25` (enviar Authorization):

```diff
- const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } });
+ const cookieHeader = request.headers.get('cookie');
+ const sessionToken = (await cookies()).get('session')?.value;
+ const headers: Record<string, string> = { 'Content-Type': 'application/json' };
+ if (cookieHeader) headers['Cookie'] = cookieHeader;
+ if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
+ const res = await fetch(url, { method, headers });
```

**Critérios:**

- [ ] Chamada sem token para `/sidecar/start` retorna 401
- [ ] Teste em `apps/worker/src/routes/__tests__/sidecar.test.ts` (novo) cobre 401 + 200

---

### 2.5 B5 — Inconsistência env var WORKER_URL (CRITICAL)

**4 rotas web usam `WOLFKROW_WORKER_URL` enquanto o resto usa `WORKER_URL`:**

1. `apps/web/app/api/audit/route.ts:3`
2. `apps/web/app/api/profiler/route.ts:3`
3. `apps/web/app/api/memory/dreaming/status/route.ts:3`
4. `apps/web/app/api/memory/dreaming/trigger/route.ts:3`

**Correção:** Substituir `WOLFKROW_WORKER_URL` por `WORKER_URL` nas 4 rotas. Adicionar fallback explícito:

```diff
- const WORKER_URL = process.env['WOLFKROW_WORKER_URL'] ?? 'http://localhost:4000';
+ const WORKER_URL = process.env['WORKER_URL'] ?? process.env['NEXT_PUBLIC_WORKER_URL'] ?? 'http://localhost:4000';
```

**Critérios:**

- [ ] `grep -r "WOLFKROW_WORKER_URL" apps/web/` retorna 0 matches
- [ ] CI passa com `WORKER_URL` apenas

---

### 2.6 B6 — Type-safety bug em mcp-servers/[id]/route.ts (CRITICAL)

**Root cause:** `optionalField<T>` inferência errada. `tsc` falha em 2 lugares.

**Correção:**

**Arquivo:** `apps/web/app/api/mcp-servers/[id]/route.ts:17-19, 25-77`

```diff
- function optionalField<T>(value: T | undefined, current: T | undefined): T | undefined {
-   return value !== undefined ? value : current;
- }
+ // Helper simples (a ?? b) — não precisa de helper custom
+ // Aplicar diretamente: `body.healthCheck ?? current.healthCheck`
```

**Adicionalmente:** Substituir todos os 8 helpers de validação por Zod `discriminatedUnion`:

```typescript
// packages/shared-types/src/schemas/mcp-server.ts (novo discriminatedUnion)
import { z } from 'zod';

const BuiltInMcpServerSchema = z.object({
  id: z.string(),
  type: z.literal('built-in'),
  isActive: z.boolean().optional(),
  visibility: z.enum(['on-startup', 'on-demand', 'background']).optional(),
});

const CustomMcpServerSchema = z.object({
  id: z.string(),
  type: z.literal('custom'),
  name: z.string().min(1).max(100),
  command: z.string().min(1).max(1024),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  // ... outros campos
  isActive: z.boolean().optional(),
  visibility: z.enum(['on-startup', 'on-demand', 'background']).optional(),
});

export const UpdateMcpServerRequestBodySchema = z.discriminatedUnion('type', [
  BuiltInMcpServerSchema,
  CustomMcpServerSchema,
]);
```

**Critérios:**

- [ ] `pnpm typecheck` passa
- [ ] Update MCP custom funciona end-to-end
- [ ] Update MCP built-in (active/visibility toggle) funciona

---

## 3. Fase 1 — Quality + Architecture Clean-up (P1 — 3 dev-days)

### 3.1 ESLint boundary enforcer (P1 — 2h)

**Objetivo:** Transformar regras "de cavalheiros" (comentários) em enforcement automatizado.

**Arquivo:** `eslint.config.mjs` (adicionar bloco):

```js
{
  files: ['apps/web/app/api/**/*.ts'],
  ignores: ['apps/web/lib/container.ts', 'apps/web/lib/auth.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@wolfkrow/infra', '@wolfkrow/infra/*'],
          message: 'Routes MUST NOT import @wolfkrow/infra directly. Use lib/container.ts.',
        },
      ],
    }],
  },
},
{
  files: ['apps/web/components/**/*.{ts,tsx}'],
  ignores: ['apps/web/components/ui/**'], // shadcn primitives
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@wolfkrow/infra', '@wolfkrow/infra/*'],
          message: 'Components MUST NOT import @wolfkrow/infra. Move seed data to @wolfkrow/shared-types.',
        },
      ],
    }],
  },
},
{
  files: ['apps/worker/src/routes/**/*.ts', 'apps/worker/src/chat/**/*.ts', 'apps/worker/src/memory/**/*.ts', 'apps/worker/src/knowledge/**/*.ts'],
  ignores: ['apps/worker/src/container.ts', 'apps/worker/src/plugins/auth.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@wolfkrow/infra/repos', '@wolfkrow/infra/services', '@wolfkrow/infra/ai-providers'],
          message: 'Worker routes/helpers MUST use getRepos() / getAdapters() from container.ts. Do not instantiate @wolfkrow/infra classes directly.',
        },
      ],
    }],
  },
},
```

**Refatorar violações identificadas (5 rotas + 1 componente):**

1. `apps/web/app/api/mcp-servers/catalog/route.ts:1` → importar de `@wolfkrow/shared-types/constants/mcp-servers`
2. `apps/web/components/pipeline/pipeline-template-picker.tsx:1` → importar de `@wolfkrow/shared-types/constants/pipeline-templates`
3. `apps/worker/src/routes/profiler.ts:1,18` → usar `getAdapters().repoProfiler`
4. `apps/worker/src/routes/mgraph.ts:5,39` → adicionar `MgraphEngine` ao `getAdapters()` (port)
5. `apps/worker/src/routes/chat.ts:7` → mover `ImagePart` type para `@wolfkrow/shared-types`
6. `apps/worker/src/chat/permission-store.ts:21,119` → usar `getRepos().toolPermission`
7. `apps/worker/src/chat/artifact-pipeline.ts:2,9` → usar `getAdapters().artifactDetector`
8. `apps/worker/src/orchestrator.ts:11,149` → usar `getAdapters().aiProviderFactory`
9. `apps/worker/src/memory/pipeline.ts:21` → usar `getRepos()` e `getAdapters()`

**Critérios:**

- [ ] `pnpm lint` passa
- [ ] CI bloqueia novos imports cross-layer
- [ ] 13 acoplamentos eliminados

---

### 3.2 Mover seeds estáticos para shared-types (P1 — 1h)

**Arquivos movidos:**

| De                                                                       | Para                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `packages/infra/src/seed/built-in-mcps.ts`                               | `packages/shared-types/src/constants/mcp-servers.ts`        |
| `packages/infra/src/seed/built-in-skills.ts`                             | `packages/shared-types/src/constants/skills.ts`             |
| `packages/infra/src/seed/pipeline-templates.ts`                          | `packages/shared-types/src/constants/pipeline-templates.ts` |
| `packages/domain/src/services/provider-registry.ts` (BUILT_IN_PROVIDERS) | `packages/shared-types/src/constants/providers.ts`          |

**Atualizar 5 consumidores:** web (3) + worker (2).

**Critérios:**

- [ ] `grep -r "BUILT_IN_MCP_SERVERS\|PIPELINE_TEMPLATES" packages/ apps/` mostra apenas imports de `@wolfkrow/shared-types`
- [ ] Build passa

---

### 3.3 Deletar dead code (P1 — 30 min)

**Deletar:** `packages/shared-types/src/errors/index.ts` (236 linhas, não importado em lugar nenhum — verificado)

**Critérios:**

- [ ] `pnpm typecheck` passa após delete

---

### 3.4 DRY helpers (P1 — 4h)

**Helper 1: `parseJsonBody<T>(request, schema)` em `apps/web/lib/validation.ts`:**

```typescript
// apps/web/lib/validation.ts (substitui validateBody)
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
```

**Aplicar em 20+ route handlers.** Refatorar todos os `validateBody(<Schema>, await request.json().catch(() => null))`.

**Helper 2: `getUserId(req)` em `apps/worker/src/lib/user-id.ts`:**

```typescript
import type { FastifyRequest } from 'fastify';

export function getUserId(req: FastifyRequest): string {
  const auth = req as unknown as { user: { userId: string } };
  return auth.user.userId;
}
```

**Aplicar em 30+ call-sites** que fazem `(req as unknown as { user: { userId } }).user.userId`.

**Helper 3: `getClientIp(request)`, `getUserAgent(request)` em `apps/web/lib/request-meta.ts`:**

```typescript
export function getClientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
}
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') ?? undefined;
}
```

**Aplicar em 7 rotas auth.**

**Critérios:**

- [ ] `pnpm test` passa após refactor
- [ ] 0 ocorrências de `await request.json().catch(() => null)` em apps/web
- [ ] 0 ocorrências de `(req as unknown as { user: { userId` em apps/worker/src/routes/

---

### 3.5 Magic numbers → constantes compartilhadas (P1 — 1h)

**Criar:** `apps/worker/src/validation/limits.ts`

```typescript
export const LIMITS = {
  MAX_BODY_BYTES: 100_000,
  MAX_SPEC_BYTES: 65_536,
  MAX_DESCRIPTION_BYTES: 8_192,
  MAX_PATH_BYTES: 4_096,
  MAX_TOKEN_THRESHOLD: 1_000_000,
  MAX_NAME_BYTES: 256,
} as const;
```

**Aplicar em 15+ zod schemas.**

**Criar:** `packages/shared-types/src/ai-limits.ts`

```typescript
export const MAX_AGENT_TURNS = 80;
export const AUTO_COMPACT_TOKEN_THRESHOLD = 8_000;
export const VEC_DIM = 1024;
```

**Aplicar em 3+ arquivos.**

**Critérios:**

- [ ] 0 magic numbers identificados na Fase de Code Quality (`100_000`, `65_536`, `8192`, `4096`, `80` em `for` loop)
- [ ] `pnpm test` passa

---

### 3.6 Refatorar AI providers duplicados (P1 — 1 dev-day)

**Problema:** `claude-agent.ts` (293L) + `claude-compat.ts` (268L) compartilham ~60% do código.

**Correção:** Extrair `AnthropicStreamingBase` em `packages/infra/src/ai-providers/anthropic-streaming-base.ts`:

```typescript
// packages/infra/src/ai-providers/anthropic-streaming-base.ts
export abstract class AnthropicStreamingBase implements AIProvider {
  abstract buildStream(opts: QueryOptions): Promise<Stream>;
  // Métodos compartilhados:
  async *query(opts: QueryOptions): AsyncIterable<StreamChunk> { ... }
  protected async processToolUseBlocks(...): AsyncIterable<...> { ... }
  protected async executeTool(...): Promise<...> { ... }
  protected async executeWithPermission(...): Promise<...> { ... }
  // ... etc
}
```

**Refatorar `claude-agent.ts` e `claude-compat.ts`** para estender a base. Cada subclasse implementa apenas `buildStream()`.

**Redução estimada: 250 linhas.**

**Critérios:**

- [ ] `claude-agent.test.ts` + `claude-compat.test.ts` passam sem modificação
- [ ] Coverage mantida
- [ ] -250 linhas (diff)

---

### 3.7 Cleanup de YAGNI (P1 — 30 min)

**Arquivo:** `packages/use-cases/src/pipeline/implement-via-harness.ts`

```diff
- const SYSTEM_USER_ID = 'system';
- ...
- void SYSTEM_USER_ID; // line 252
+ // SYSTEM_USER_ID removido (YAGNI)
```

**Arquivo:** `apps/web/app/api/mcp-servers/[id]/route.ts:17-19` (deletar `optionalField`)

**Critérios:**

- [ ] `pnpm typecheck` e `pnpm lint` passam

---

### 3.8 Refatorar God-classes e long-functions (P1 — 1 dev-day)

**God-class 1: `apps/worker/src/routes/memory.ts` (151L, 3 domínios)**

Quebrar em:

- `routes/memory.ts` (CRUD + search) — 50L
- `routes/memory-summaries.ts` (daily summaries) — 30L
- `routes/memory-dreaming.ts` (dreaming + compaction log) — 50L

**Long-function 1: `apps/worker/src/routes/chat.ts:159` (`handleSendRequest` 53L)**

Extrair:

- `prepareAgentAI()` (10L)
- `executeChatStream()` (15L)
- `finalizeChatTurn()` (10L)

**Long-function 2: `apps/worker/src/routes/pipeline.ts:118` (`streamAiPhase` 27L duplicado com `runAiPhase` 38L)**

Extrair `buildWrappedProvider(project)` reutilizável.

**Critérios:**

- [ ] Cada arquivo < 100 linhas
- [ ] `pnpm test` passa
- [ ] Cobertura mantida

---

## 4. Fase 2 — Features Gap vs Lionclaw (P0 — 5 dev-days)

### 4.1 G1 — Cadastro de Projetos Harness com path (1 dev-day)

**Objetivo:** Permitir criar projeto Harness com `name`, `description`, `path`, `agent`, `model`.

**Backend (worker):**

**Arquivo 1:** `apps/worker/src/routes/harness.ts` — adicionar endpoints:

```typescript
// POST /harness/projects (com projectPath, allowlist validation)
server.post('/harness/projects', { onRequest: [server.authenticate] }, async (req, reply) => {
  const body = CreateHarnessProjectSchema.parse(req.body);
  const userId = getUserId(req);
  const validatedPath = validateProjectPath(body.projectPath); // throws se fora allowlist
  const useCase = container.get(CreateHarnessProjectUseCase);
  const project = await useCase.execute({ ...body, userId, projectPath: validatedPath });
  return project;
});
```

**Arquivo 2:** `packages/infra/src/repos/harness-project-repo.ts` — adicionar métodos `createWithPath`, `updatePath`.

**Use case (já existe):** `packages/use-cases/src/harness/create-harness-project.ts` — refatorar para incluir `projectPath`.

**Frontend (web):**

**Arquivo 3:** `apps/web/components/harness/new-project-modal.tsx` (já existe) — refatorar para incluir campo `Project Path`:

```tsx
<div className="space-y-2">
  <Label htmlFor="projectPath">Project Path</Label>
  <Input
    id="projectPath"
    placeholder="/Users/juniorfaria/projects/my-app"
    value={projectPath}
    onChange={(e) => setProjectPath(e.target.value)}
  />
  <p className="text-muted-foreground text-xs">Must be within the allowed project roots.</p>
</div>
```

**Validação:** usar `validateProjectPath` server-side (já existe em `apps/worker/src/lib/project-path.ts`).

**Critérios:**

- [ ] Criar projeto Harness com path funciona
- [ ] Path fora do allowlist retorna 400 com mensagem clara
- [ ] Teste E2E: `apps/web/e2e/harness-create.spec.ts` (novo) passa
- [ ] UI mostra lista de allowlist (WOLFKROW_ALLOWED_PROJECT_ROOTS) para o user

---

### 4.2 G2 + G3 — Run Console com Timeline + Chat HITL (2 dev-days)

**Objetivo:** Run console full-screen com visualização timeline e chat para interação humana no loop (HITL).

**Inspiração:** LionClaw `components/pipeline/PipelineChatView`, `PipelineStreamView`, `SprintExecutionView`.

**Backend (worker):**

**Arquivo 1:** `apps/worker/src/routes/pipeline.ts` — adicionar endpoint para HITL:

```typescript
// POST /pipeline/projects/:id/phases/:phaseId/chat
// Body: { message: string, role: 'user' | 'assistant' }
// Server: persiste mensagem, dispara round do agent, retorna stream SSE
server.post(
  '/pipeline/projects/:id/phases/:phaseId/chat',
  { onRequest: [server.authenticate] },
  async (req, reply) => {
    // ... validação ...
    // Usa UseCase SendMessageUseCase com sessionId = phaseId
    // Stream SSE igual a /chat/send
  }
);
```

**Adicionar `phase_chat_messages` tabela** (Drizzle migration 0011):

```typescript
export const phaseChatMessages = sqliteTable(
  'phase_chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    projectId: text('project_id').notNull(),
    phaseId: text('phase_id').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('phase_chat_user_idx').on(table.userId),
    projectIdx: index('phase_chat_project_idx').on(table.projectId, table.phaseId),
  })
);
```

**Use case novo:** `packages/use-cases/src/pipeline/send-phase-message.ts`

**Frontend (web):**

**Arquivo 2:** `apps/web/components/pipeline/pipeline-run-console.tsx` — refatorar para incluir 3 painéis:

```
┌─ Run Console ─────────────────────────────────────────────────┐
│ ┌─ Header: Project Name + Phase + Status ───────────────────┐ │
│ ├─ Tab Bar: [Timeline] [Sprints] [Chat HITL] [Metrics] ────┤ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │  [Active panel — default Timeline]                         │ │
│ │                                                              │ │
│ │  Timeline view:                                             │ │
│ │  - vertical timeline of rounds/sprints                      │ │
│ │  - each node: round number, agent, duration, cost          │ │
│ │  - click to expand diff/messages                            │ │
│ │  - live updates via SSE                                     │ │
│ │                                                              │ │
│ │  Chat HITL view:                                            │ │
│ │  - chat-like interface (similar to ChatPage)                │ │
│ │  - can ask questions, give feedback mid-execution           │ │
│ │  - uses SendMessageUseCase with phaseId as sessionId       │ │
│ │  - SSE streaming                                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─ Footer: phase action buttons (Pause/Resume/Abort) ────────┐ │
└──────────────────────────────────────────────────────────────────┘
```

**Componente Timeline:**

```tsx
// apps/web/components/common/timeline.tsx (novo, genérico)
export interface TimelineNode {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
  children?: TimelineNode[];
}

export function Timeline({
  nodes,
  onSelect,
}: {
  nodes: TimelineNode[];
  onSelect?: (n: TimelineNode) => void;
}) {
  return (
    <ol className="relative ml-3 border-l border-zinc-200 dark:border-zinc-800">
      {nodes.map((node) => (
        <TimelineItem key={node.id} node={node} onSelect={onSelect} />
      ))}
    </ol>
  );
}
```

**Componente Chat HITL:** reutilizar `apps/web/components/chat/chat-view.tsx` com prop `sessionId={phaseId}`.

**Critérios:**

- [ ] Run console mostra timeline visual de execuções
- [ ] Chat HITL funciona (envia mensagem, recebe stream, persiste)
- [ ] Mesma UI para harness e pipeline
- [ ] Teste E2E: `apps/web/e2e/pipeline-hitl.spec.ts` (novo) passa
- [ ] Teste E2E: `apps/web/e2e/harness-hitl.spec.ts` (novo) passa

---

### 4.3 FP1 — Provider edit com id locked (1 dev-day)

**Objetivo:** Editar provider existente sem criar novo registro.

**Arquivo:** `apps/web/components/settings/provider-config/provider-form-modal.tsx`

**Bug atual:** `applyNonBuiltInCustomSave()` chama `repo.create()` com `id` novo em vez de `repo.update(id, ...)`.

**Correção:**

```typescript
// Em provider-form-modal.tsx
const isEditMode = !!existingProvider;

const onSubmit = async (data: ProviderFormData) => {
  if (isEditMode && existingProvider) {
    // Lock id: NÃO enviar id no body, server usa o id da URL
    const { id, ...updates } = data;
    await providersApi.update(existingProvider.id, {
      ...updates,
      hasApiKey: !!data.apiKey,
    });
  } else {
    await providersApi.create(data);
  }
};
```

**Backend:** `apps/worker/src/routes/providers.ts` — confirmar que `PUT /providers/:id` usa o id da URL, não do body.

**Critérios:**

- [ ] Editar provider Z.ai mantém o id; não cria novo registro
- [ ] Listagem após edit mostra apenas 1 registro (não 2)
- [ ] Teste unitário: `apps/web/components/settings/provider-config/__tests__/provider-form-modal.test.tsx` (novo)

---

### 4.4 FP8 + G5 + G6 — Polir cadastro de agents (1 dev-day)

**Objetivo:** Ordem dos campos conforme lionclaw, com MarkdownEditor inline.

**Arquivo:** `apps/web/components/agents/agent-form-body.tsx`

**Ordem dos campos (lionclaw):**

1. Nome
2. System Prompt (com MarkdownEditor)
3. Effort
4. Max Turn
5. Provider
6. Model
7. Runtime

**Correção:** Reordenar JSX.

**Critérios:**

- [ ] Form renderiza com ordem correta
- [ ] System Prompt usa MarkdownEditor com preview
- [ ] Teste snapshot: `apps/web/components/agents/__tests__/agent-form-body.test.tsx` (verificar ordem)

---

### 4.5 FP9 — Configuração de Channels (1 dev-day)

**Objetivo:** Tela de configuração com dados necessários para múltiplos channels.

**Arquivo:** `apps/web/components/channels/channels-list.tsx` — refatorar para suportar:

- Telegram (funcional) — já existe
- Discord (placeholder com OAuth flow stub)
- Slack (placeholder com OAuth flow stub)
- WhatsApp (placeholder)
- PSN (placeholder)
- Phone (placeholder)

**Backend (worker):** `apps/worker/src/routes/channels.ts` (criar)

```typescript
// GET /channels - lista channels configurados
// POST /channels - cria channel
// PUT /channels/:id - atualiza
// DELETE /channels/:id - remove
// POST /channels/:id/test - testa conexão
```

**Schema Drizzle:** adicionar `channels` table (já existe, verificar).

**Critérios:**

- [ ] Tela mostra todos os 6 channels (Telegram funcional + 5 placeholders com config UI)
- [ ] CRUD de channel Telegram funciona
- [ ] Teste E2E: `apps/web/e2e/channels.spec.ts` (novo) passa

---

## 5. Fase 3 — Paginação + Sem Bloqueio por Usuário (P1 — 1 dev-day)

### 5.1 Paginação em todos os endpoints (4h)

**Objetivo:** Adicionar `?page=N&pageSize=M` em todas as listagens.

**Padrão:** Response envelope:

```typescript
type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number; // 1-indexed
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
```

**Helper:** `apps/web/lib/pagination.ts`

```typescript
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
    )
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}
```

**Endpoints a paginar (12):**

| Endpoint                         | Repo                          | Mudança                                                              |
| -------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `GET /api/agents`                | `agent-repo.ts:18`            | Adicionar `findAll({ userId, offset, limit })` + `count({ userId })` |
| `GET /api/skills`                | `skill-repo.ts:18`            | Idem                                                                 |
| `GET /api/chat/sessions`         | `chat-repos.ts:19`            | Idem                                                                 |
| `GET /api/knowledge/documents`   | `knowledge-doc-repo.ts:35`    | Idem                                                                 |
| `GET /api/tasks`                 | `task-repo.ts:25-36`          | Idem                                                                 |
| `GET /api/scheduler/tasks`       | `scheduled-task-repo.ts:38`   | Idem                                                                 |
| `GET /api/pipeline/projects`     | `pipeline-project-repo.ts:59` | Idem                                                                 |
| `GET /api/harness/projects`      | `harness-project-repo.ts:38`  | Idem                                                                 |
| `GET /api/enrich/sessions`       | `enrich-session-repo.ts:50`   | Idem                                                                 |
| `GET /api/memory`                | `semantic-memory-repo.ts:49`  | Idem                                                                 |
| `GET /api/rules`                 | `rule-repo.ts:25`             | Idem                                                                 |
| `GET /api/permissions/decisions` | `permission-repo.ts:30`       | Idem                                                                 |

**Componentes UI a atualizar (12):** adicionar `<Pagination />` no rodapé de cada lista:

```tsx
// apps/web/components/common/pagination.tsx (novo)
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="flex items-center justify-between border-t px-2 py-3">
      <div className="text-muted-foreground text-sm">
        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Critérios:**

- [ ] Todas as 12 listagens retornam envelope `PaginatedResponse<T>`
- [ ] UI tem `<Pagination />` visível
- [ ] `?page=999&pageSize=20` retorna 404/empty
- [ ] Teste E2E: smoke para cada listagem

---

### 5.2 Remover bloqueios por usuário (4h)

**Objetivo:** App NÃO deve limitar funcionalidades/cadastros por usuário.

**Arquivo 1:** `apps/web/lib/auth.ts:54-70`

```diff
- const sharedWorkspace = process.env['WOLFKROW_SHARED_WORKSPACE'] !== 'false';
- if (sharedWorkspace) {
-   // rewrite userId to owner
-   session.userId = ownerId;
- }
+ // Por padrão, isolamento por usuário é respeitado (single-user = mesmo owner)
+ // Para workspaces compartilhados, defina WOLFKROW_SHARED_WORKSPACE=true
+ const sharedWorkspace = process.env['WOLFKROW_SHARED_WORKSPACE'] === 'true';
+ if (!sharedWorkspace && session.userId !== ownerId) {
+   // Permitir acesso; cada usuário tem seu próprio namespace
+ }
```

**Arquivo 2:** `apps/worker/src/plugins/auth.ts:42-48` — mesma correção.

**Arquivo 3:** Validar que **NENHUMA** rota tem filtro `WHERE user_id != owner_id` para limitar acesso. Procurar:

```bash
grep -rn "userId !== ownerId\|user_id != '" apps/ apps/worker apps/web
```

**Remover** qualquer filtro que impeça user A de ver/editar resources de user B em single-user setup.

**Teste:** Garantir que um único usuário pode ver todos os cadastros sem bloqueios:

```typescript
// apps/web/__tests__/no-user-blocking.test.tsx
test('user can access all features without blocking', async () => {
  // Login
  // Navigate to /agents, /skills, /mcp-servers, etc
  // Verify all forms are accessible, no locks/filters
});
```

**Critérios:**

- [ ] User tem acesso a todas as funcionalidades
- [ ] Nenhum cadastro é bloqueado por user
- [ ] Logs mostram userId real (não reescrito)
- [ ] Teste E2E: smoke por todas as 24 rotas

---

## 6. Fase 4 — Cobertura de Testes `packages/infra` (P1 — 2 dev-days)

> **Gap:** `packages/infra` está em 72.18%, PRD exige ≥85%. Gap de 12.82pp.

### 6.1 Testes para 5 arquivos com 0% (4h)

| Arquivo                         | Linhas | Testes a criar                                                    |
| ------------------------------- | ------ | ----------------------------------------------------------------- |
| `secrets/keytar-adapter.ts`     | 23     | 4 testes: get/set/delete/list com mock de keytar                  |
| `embeddings/voyage-embedder.ts` | 37     | 3 testes: happy, batch, API error                                 |
| `auth/keypair-store.ts`         | 50     | 4 testes: generate, serialize, load, rotation                     |
| `auth/jwt.ts`                   | 80     | 5 testes: sign+verify round-trip, expiry, wrong secret, malformed |
| `auth/bcrypt-hasher.ts`         | 30     | 3 testes: hash+verify, wrong password, timing                     |

**Padrão de mock:** `vi.mock('keytar')` em cada teste.

**Critérios:**

- [ ] 5 arquivos com 100% coverage
- [ ] Total `packages/infra` sobe para ~80%

---

### 6.2 Testes para 25 repos sem teste (1 dev-day)

**Repos prioritários:**

| Repo                       | Linhas | Testes | Tipo                      |
| -------------------------- | ------ | ------ | ------------------------- |
| `user-repo.ts`             | 80     | 5      | Integration (SQLite real) |
| `secret-repo.ts`           | 60     | 4      | Integration               |
| `global-rule-repo.ts`      | 70     | 4      | Integration               |
| `token-usage-repo.ts`      | 90     | 5      | Integration               |
| `tool-permission-repo.ts`  | 75     | 4      | Integration               |
| `security-audit-repo.ts`   | 95     | 5      | Integration               |
| `pipeline-phase-repo.ts`   | 100    | 6      | Integration               |
| `harness-project-repo.ts`  | 85     | 5      | Integration               |
| `harness-sprint-repo.ts`   | 70     | 4      | Integration               |
| `harness-round-repo.ts`    | 90     | 5      | Integration               |
| `knowledge-doc-repo.ts`    | 110    | 6      | Integration               |
| `knowledge-chunk-repo.ts`  | 130    | 7      | Integration               |
| `knowledge-cosine-repo.ts` | 50     | 3      | Integration               |
| `knowledge-hybrid-repo.ts` | 80     | 5      | Integration               |
| `pipeline-project-repo.ts` | 90     | 5      | Integration               |
| `pipeline-message-repo.ts` | 75     | 4      | Integration               |
| `enrich-session-repo.ts`   | 65     | 4      | Integration               |
| `skill-repo.ts`            | 70     | 4      | Integration               |
| `audit-log-repo.ts`        | 100    | 5      | Integration               |
| `compaction-log-repo.ts`   | 60     | 3      | Integration               |
| `daily-summary-repo.ts`    | 70     | 4      | Integration               |
| `graph-repo.ts`            | 95     | 5      | Integration               |
| `scheduled-task-repo.ts`   | 90     | 5      | Integration               |
| `task-run-repo.ts`         | 70     | 4      | Integration               |
| `workflow-run-repo.ts`     | 80     | 4      | Integration               |

**Total:** ~110 testes novos.

**Padrão:** usar `chat-repos.integration.test.ts` como template (já existe, integration com SQLite real).

**Critérios:**

- [ ] 25 repos com ≥1 teste cada
- [ ] `packages/infra` coverage ≥85% ✅
- [ ] `pnpm test` passa

---

### 6.3 Testes para `use-cases/audit/run-audit.ts` (1h)

**Arquivo:** `packages/use-cases/src/audit/run-audit.ts` (17% coverage)

**Testes a criar:** 6 testes (happy path, error path, scanId generation, AI provider failure, partial findings, cancellation).

**Critérios:**

- [ ] `use-cases/audit` coverage ≥80%
- [ ] `pnpm test` passa

---

### 6.4 Testes para Vault UI (1h)

**Arquivo:** `apps/web/components/vault/vault-view.tsx` (49.56% stmts, 29.16% funcs)

**Testes a criar (8):**

- Renderiza lista de secrets masked
- Click em "Add secret" abre modal
- Submit form adiciona secret
- Click em "Delete" abre confirm dialog
- Click em "Copy masked" copia para clipboard
- Export encripta backup
- Import decripta backup
- Test connection (Telegram)

**Critérios:**

- [ ] `vault-view` coverage ≥80%
- [ ] `pnpm test` passa

---

## 7. Fase 5 — E2E Specs Faltantes (P1 — 3 dev-days)

> **Gap:** 9 domínios sem E2E: agents, skills, mcp, scheduler, rules, knowledge, memory, harness, pipeline.

### 7.1 agents.spec.ts (4h)

**Cenários (6):**

- Lista de agents carrega
- Criar novo agent (com todos os campos)
- Editar agent existente
- Deletar agent (com confirmação)
- Duplicate agent
- Sync agents to orchestrator

### 7.2 skills.spec.ts (4h)

**Cenários (5):**

- Lista de skills (built-in + custom)
- Criar skill com MarkdownEditor
- Editar skill bundled
- Deletar skill custom
- Attach skill a agent

### 7.3 mcp-servers.spec.ts (4h)

**Cenários (6):**

- Lista de MCPs (built-in + custom)
- Built-in MCPs exibidos (corrigir bug "nenhum MCP exibido")
- Criar custom MCP
- Editar custom MCP
- Start/stop/restart MCP
- Health check

### 7.4 scheduler.spec.ts (3h)

**Cenários (4):**

- Lista de scheduled tasks
- Criar task com cron
- Manual trigger
- Review queue (validated/rejected)

### 7.5 rules.spec.ts (2h)

**Cenários (3):**

- Lista de rules
- Criar rule com MarkdownEditor
- Toggle rule

### 7.6 knowledge.spec.ts (4h)

**Cenários (5):**

- Upload de PDF (testa B2 corrigido)
- Lista de documents
- Search semântica
- Delete document
- Config (chunk strategy)

### 7.7 memory.spec.ts (3h)

**Cenários (4):**

- Lista de memories
- Add memory
- Search semântica
- Dreaming trigger

### 7.8 harness.spec.ts (4h)

**Cenários (5):**

- Lista de projects
- Criar project com path (testa G1)
- Run console com timeline (testa G3)
- Chat HITL (testa G2)
- Sprint view

### 7.9 pipeline.spec.ts (4h)

**Cenários (5):**

- Lista de projects
- Criar pipeline com template
- Run console com timeline
- Chat HITL
- Pipeline report

**Critérios:**

- [ ] 9 specs E2E novos, todos passando em CI
- [ ] Total E2E: 19 specs, ~120 testes
- [ ] `pnpm e2e` exit code 0

---

## 8. Fase 6 — Layout/UX Polish (P1 — 4 dev-days)

### 8.1 Redesign Harness + Pipeline screens (2 dev-days)

**Problema atual:**

- Double-titles (PageHeader + h2 interno)
- Sem timeline visual
- Sem chat HITL inline
- Confuso em resoluções pequenas

**Correção (lionclaw-inspired + otimizado Next.js):**

**Layout-alvo:**

```
┌─ Harness/Pipeline Page ─────────────────────────────────────┐
│ ┌─ Topbar (breadcrumb) ───────────────────────────────────┐ │
│ │ Home > Harness > Project Name                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ PageHeader: title + description + actions ─────────────┐ │
│ │ Harness          [+ New Project] [Search] [Filters]     │ │
│ │ Build, test, and deploy code automatically              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Main: 2-col layout ────────────────────────────────────┐ │
│ │ ┌─ Left: Project List (320px) ──┐ ┌─ Right: Detail ────┐ │
│ │ │ [+ New Project]              │ │ Project Name        │ │
│ │ │                              │ │ Status badge        │ │
│ │ │ 🔵 my-app                    │ │ ────────────────    │ │
│ │ │ 🟢 other-project             │ │ [Tabs]              │ │
│ │ │ 🟡 stuck-project             │ │ [Sprints][Runs]     │ │
│ │ │                              │ │ [Chat HITL][Metrics]│ │
│ │ │ [Pagination]                 │ │                     │ │
│ │ └──────────────────────────────┘ │ [Active panel]      │ │
│ │                                  │                     │ │
│ │                                  │ [Footer: actions]   │ │
│ │                                  └─────────────────────┘ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Inspiração:** LionClaw `PipelinePage.tsx` + `ProjectList` + `ProjectCard` + `SprintListBar`.

**Otimizações Next.js:**

- RSC para `ProjectList` (sem 'use client')
- Client Component para Detail (interatividade)
- `next/dynamic` para `RunConsole` (lazy load)
- Suspense boundary com skeleton para `MetricsView`

**Critérios:**

- [ ] Double-titles eliminados
- [ ] Timeline visual para execuções
- [ ] Chat HITL inline em RunConsole
- [ ] Responsivo (mobile + tablet + desktop)
- [ ] Teste snapshot: `apps/web/components/harness/__tests__/harness-view.test.tsx`

---

### 8.2 Polir Sidebar (1 dev-day)

**Validações:**

- Todos os 24 itens têm rota válida ✅ (já validado)
- Sem duplicação ✅
- Agrupamento: Main / Automation / Tools / System (já tem)

**Melhorias:**

- **Badges de contador:** review queue, pending runs, etc
- **Indicador de "novo"** em features recentes (channels, audit, profiler)
- **Tooltip** com descrição em hover
- **Atalhos de teclado** (1-9 para primeiros 9 itens)

**Critérios:**

- [ ] `CommandPalette` (⌘K) inclui todos os 24 itens
- [ ] Badges funcionais
- [ ] Teste E2E: `apps/web/e2e/sidebar.spec.ts`

---

### 8.3 Polir Detail Screens (1 dev-day)

**Telas a polir:**

| Tela                     | Mudança                                                 |
| ------------------------ | ------------------------------------------------------- |
| `agent-edit-screen`      | Tabs: Basic / System Prompt / Tools / Skills / Advanced |
| `skill-edit-screen`      | Tabs: Content (MarkdownEditor) / Frontmatter / Preview  |
| `rule-edit-screen`       | Tabs: Content (MarkdownEditor) / Scope / Preview        |
| `mcp-server-edit-screen` | Tabs: Config / Env / Health / Logs                      |
| `provider-form-modal`    | Tabs: Config / Models / Test Connection                 |

**Critérios:**

- [ ] Tabs implementadas com `Tabs` component (shadcn)
- [ ] MarkdownEditor com preview em todas as telas de conteúdo
- [ ] Teste visual: `apps/web/e2e/visual-regression.spec.ts` atualizado

---

### 8.4 Adicionar Métricas (1 dev-day)

**Dashboard widgets (lionclaw):**

- Sessions ativas (chat)
- Total tokens (24h / 7d / 30d)
- Total cost (24h / 7d / 30d)
- MCPs ativos
- Harness runs (success / fail rate)
- Pipeline runs (success / fail rate)
- Voice usage (STT / TTS minutos)
- Telegram messages

**Backend:** adicionar endpoints em `apps/worker/src/routes/usage.ts`:

```typescript
// GET /usage/dashboard — métricas agregadas
server.get('/usage/dashboard', { onRequest: [server.authenticate] }, async (req, reply) => {
  const userId = getUserId(req);
  return {
    activeChatSessions: await chatSessionRepo.countByUserAndStatus(userId, 'active'),
    tokensLast24h: await tokenUsageRepo.sumByUserAndPeriod(userId, '24h'),
    costLast24h: await tokenUsageRepo.costByUserAndPeriod(userId, '24h'),
    activeMcps: await mcpServerRepo.countByUserAndStatus(userId, 'running'),
    // ... etc
  };
});
```

**Frontend:** `apps/web/components/dashboard/dashboard-view.tsx` — adicionar widgets em grid 2x4.

**Critérios:**

- [ ] Dashboard mostra 8 widgets
- [ ] Performance: queries paralelas com `Promise.all`
- [ ] Skeleton loading

---

## 9. Fase 7 — Auditoria Final (P1 — 1 dev-day)

> **Objetivo:** Validação rigorosa de TODAS as funcionalidades, garantindo que não há bugs ou erros.

### 9.1 Checklist de Validação (matriz 1:1 com requisitos)

| #   | Requisito                                      | Validação                         | Status |
| --- | ---------------------------------------------- | --------------------------------- | ------ |
| 1   | funcionalidade realmente implementada          | `grep` + manual test em cada rota | ☐      |
| 2   | funcionalidade implementada de forma funcional | Manual test + E2E                 | ☐      |
| 3   | clean code                                     | `pnpm lint` + `pnpm typecheck`    | ☐      |
| 4   | clean arch                                     | `pnpm lint` (ESLint boundary)     | ☐      |
| 5   | solid                                          | Code review manual                | ☐      |
| 6   | dry                                            | `grep` para padrões duplicados    | ☐      |
| 7   | yagni                                          | `grep` para dead code             | ☐      |
| 8   | sem bugs                                       | Manual test + E2E                 | ☐      |
| 9   | sem débito técnico                             | `grep TODO FIXME DEBT`            | ☐      |
| 10  | testes unitários sem falhas                    | `pnpm test` exit 0                | ☐      |
| 11  | teste unitário valida código                   | Code review + coverage report     | ☐      |
| 12  | implementação segue plano                      | Code review vs Fase 0-6           | ☐      |
| 13  | frontend layout moderno/minimalista            | Visual review                     | ☐      |
| 14  | frontend componentes padronizados              | shadcn/ui only                    | ☐      |
| 15  | frontend reflete funcionalidades               | E2E test por feature              | ☐      |
| 16  | integração backend↔frontend                    | E2E completo                      | ☐      |
| 17  | frontend bem distribuído                       | Visual review                     | ☐      |
| 18  | frontend UI/UX best practices                  | Visual review                     | ☐      |
| 19  | frontend sem ambiguidade                       | Manual test                       | ☐      |
| 20  | token 30 dias                                  | Unit test                         | ☐      |
| 21  | bloqueio só após 30 dias                       | Unit test                         | ☐      |
| 22  | agents ordem campos                            | Visual + E2E                      | ☐      |
| 23  | skills edição qualquer                         | E2E                               | ☐      |
| 24  | providers edição sem duplicar                  | E2E                               | ☐      |
| 25  | channels config                                | E2E                               | ☐      |
| 26  | harness run console + chat HITL + timeline     | E2E                               | ☐      |
| 27  | pipeline run console + chat HITL + timeline    | E2E                               | ☐      |
| 28  | cadastro de projetos                           | E2E                               | ☐      |
| 29  | auditoria SDKs (GLM/Kimi/MiniMax/Qwen)         | Unit + E2E                        | ☐      |
| 30  | Open Design Studio funcional                   | E2E                               | ☐      |
| 31  | chat sem bloqueios por user                    | E2E                               | ☐      |
| 32  | paginação em todas as páginas                  | E2E                               | ☐      |
| 33  | sem bloqueios por usuário                      | Manual + E2E                      | ☐      |
| 34  | sem débito técnico tracked                     | `grep DEBT #`                     | ☐      |

### 9.2 Auditoria Específica de Bugs Conhecidos

| Bug                             | Validação                                   |
| ------------------------------- | ------------------------------------------- |
| B1 keychain mismatch            | Test: adicionar Z.ai key + chat com glm-4.7 |
| B2 knowledge upload 401         | Test: upload PDF via UI                     |
| B3 auth-bypass audit            | Test: curl sem token para /api/audit/run    |
| B4 sidecar sem auth             | Test: curl sem token para /sidecar/start    |
| B5 env var inconsistente        | Test: build com WORKER_URL apenas           |
| B6 type-safety bug              | Test: `pnpm typecheck`                      |
| FP1 provider edit duplica       | Test: edit Z.ai + verificar lista           |
| FP8 harness run console confuso | Test: visual review                         |
| G1 sem cadastro de projeto      | Test: criar project com path                |
| G2 sem chat HITL                | Test: enviar msg durante run                |
| G3 sem timeline                 | Test: visual review                         |
| MCPs não exibidos               | Test: list MCPs após install                |

### 9.3 Auditoria de Layout/UX

**Ações manuais:**

1. **Acessar cada uma das 24 rotas** e verificar:
   - Sem double-titles
   - Layout responsivo (mobile/tablet/desktop)
   - Sem overflow / scroll lateral
   - Cores consistentes
   - Ícones semânticos (não confusos)
   - Spacing uniforme

2. **Testar chat completo:**
   - Criar session
   - Enviar mensagem com Anthropic
   - Enviar mensagem com GLM (testa B1)
   - Enviar mensagem com Ollama
   - Tool call aparece
   - Stop button funciona
   - Delete session

3. **Testar run console:**
   - Criar project Harness (testa G1)
   - Iniciar run
   - Ver timeline (testa G3)
   - Enviar msg HITL (testa G2)
   - Pause/resume
   - Ver métricas

4. **Testar paginação (12 endpoints):**
   - Navegar para cada lista
   - Verificar `Pagination` component visível
   - Page 1, 2, 3 funcionam
   - `?page=999` retorna empty

5. **Testar sem bloqueios por usuário:**
   - Login
   - Acessar todas as 24 rotas
   - Verificar que nenhum form/botão está bloqueado

### 9.4 Auditoria de Segurança

| #   | Teste                                                           | Esperado                         |
| --- | --------------------------------------------------------------- | -------------------------------- |
| S1  | `curl -X POST http://localhost:3000/api/audit/run` (sem cookie) | 401                              |
| S2  | `curl http://localhost:4000/sidecar/start` (sem Bearer)         | 401                              |
| S3  | Upload de arquivo com `../../etc/passwd` no nome                | rejeitado                        |
| S4  | Adicionar key Z.ai com espaço no início                         | trimmed                          |
| S5  | Cookie de sessão em HTTP (não HTTPS)                            | rejeitado (secure: true em prod) |
| S6  | Rate limit: 20 logins em 1 min                                  | 11+ retornam 429                 |
| S7  | `validateProjectPath('/etc/passwd')`                            | throws                           |
| S8  | `validateProjectPath('${HOME}/projects/my-app')`                | ok                               |

### 9.5 Auditoria de Performance

**Métricas-alvo:**

| Métrica                    | Target       | Como medir              |
| -------------------------- | ------------ | ----------------------- |
| TTFB (homepage)            | <200ms       | Lighthouse              |
| TTI (chat)                 | <1s          | Lighthouse              |
| Time to First Token (chat) | <500ms (P95) | Custom metric           |
| Bundle size (web)          | <500KB gzip  | `pnpm build`            |
| SQLite query time          | <10ms P95    | `EXPLAIN QUERY PLAN`    |
| Memory usage (worker idle) | <200MB       | `process.memoryUsage()` |

**Ações se fora do target:**

- Adicionar `loading.tsx` Suspense boundaries
- `next/dynamic` para code-splitting
- React Server Components para reduzir JS
- Drizzle indexes em colunas lentas

### 9.6 Relatório Final

**Template de output:**

```markdown
# Auditoria Final — Wolfkrow-Tool MVP

**Data:** YYYY-MM-DD
**Versão:** 1.0
**Reviewer:** [name]

## Resumo

- Bugs encontrados: N (lista)
- Features gap restantes: N (lista)
- Cobertura testes: backend X% / frontend Y% / infra Z%
- Performance: TTFB Xms / TTI Yms / bundle ZKB
- Segurança: N vulnerabilidades (lista)

## Conformidade vs PRD

- [x] TDD
- [x] Cobertura ≥85% backend
- [x] Cobertura ≥70% frontend
- [x] Cobertura ≥85% infra
- [x] TypeScript strict
- [x] ESLint
- [x] Clean Arch
- [x] SOLID/DRY/YAGNI

## Features Implementadas vs Lionclaw

- 55/55 (100% de features não-deferidas)
- 8 melhorias adicionais

## Pendências para v1.1

- Lista priorizada

## Aprovação

- [x] Product Owner
- [x] Tech Lead
```

---

## 10. Cronograma de Execução

```
Semana 1 (5 dias)
├── Dia 1: Fase 0 (Bug Fixes BLOCKER/CRITICAL)
├── Dia 2-4: Fase 1 (Quality + Architecture)
└── Dia 5: Buffer + Code Review Fase 0+1

Semana 2 (5 dias)
├── Dia 1-3: Fase 2.1-2.3 (Features Gap parte 1: cadastro, run console, provider edit)
├── Dia 4-5: Fase 2.4-2.5 (Features Gap parte 2: agent form, channels)

Semana 3 (5 dias)
├── Dia 1: Fase 3 (Paginação + sem bloqueios)
├── Dia 2-3: Fase 4 (Cobertura testes)
├── Dia 4-5: Fase 5.1-5.5 (E2E specs parte 1)

Semana 4 (5 dias)
├── Dia 1-3: Fase 5.6-5.9 + Fase 6 (E2E parte 2 + Layout polish)
├── Dia 4: Fase 6.4 (Métricas dashboard)
└── Dia 5: Fase 7 (Auditoria final)
```

**Total:** 20 dev-days ≈ 4 semanas (1 dev full-time)

---

## 11. Riscos & Mitigações

| #   | Risco                                                                             | Probabilidade | Impacto | Mitigação                                                                             |
| --- | --------------------------------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------- |
| R1  | B1 keychain fix quebra chaves existentes (chaves em 'wolfkrow-tool' são perdidas) | Alta          | Médio   | Migration script: lê 'wolfkrow-tool/_' e grava em 'wolfkrow/_' antes de mudar SERVICE |
| R2  | Paginação quebra consumers que esperam array direto                               | Média         | Alto    | Manter backward-compat: se `?page` ausente, retorna array (sem envelope)              |
| R3  | ESLint boundary enforcer bloqueia PRs legítimos                                   | Média         | Médio   | Documentar exceções em `lib/container.ts`, `lib/auth.ts`, `container.ts` worker       |
| R4  | E2E flaky (visual regression, keyboard nav)                                       | Alta          | Baixo   | Marcar como `test.fixme` + issue tracker; meta é smoke E2E, não perfection            |
| R5  | Cobertura 85% em `packages/infra` requer 100+ testes                              | Média         | Médio   | Foco em repos críticos (user, secret, rule) + 5 arquivos 0%                           |
| R6  | Run console com timeline + HITL é 2 dev-days                                      | Baixa         | Alto    | MVP da timeline pode ser lista simples com timestamps; HITL pode ser MVP              |
| R7  | Refactor DRY (claude-agent + claude-compat) pode introduzir bugs                  | Média         | Alto    | TDD: refactor com testes verdes antes; cobertura 100% nos providers antes             |
| R8  | Shared-workspace=false default pode quebrar single-user workflows                 | Baixa         | Alto    | Migration guide + log warning + auto-detect (1 user = default true)                   |

---

## 12. Entregáveis

**Código:**

- 6 bug fixes (B1-B6)
- 13 acoplamentos de camada eliminados
- 4 helpers DRY criados
- 6 features gap implementadas
- 12 endpoints com paginação
- 110+ testes unitários novos
- 9 specs E2E novos (40+ testes)
- Layout Harness/Pipeline redesign

**Documentação:**

- `mvp_final_plan_minimax.md` (este arquivo)
- ADRs novos:
  - `ADR-0034-keychain-single-service.md`
  - `ADR-0035-pagination-envelope.md`
  - `ADR-0036-eslint-boundary-enforcement.md`
  - `ADR-0037-shared-workspace-default.md`
- `FEATURE_MATRIX.md` atualizado
- `CHANGELOG.md` com v1.0 entry

**Relatórios:**

- Coverage report (HTML)
- E2E report (Playwright HTML)
- Auditoria final (template Fase 7.6)

---

## 13. Aprovação Necessária

| Papel         | Pessoa       | Status |
| ------------- | ------------ | ------ |
| Product Owner | Junior Faria | ☐      |
| Tech Lead     | Junior Faria | ☐      |
| Dev Frontend  | TBD          | ☐      |
| Dev Backend   | TBD          | ☐      |
| QA            | TBD          | ☐      |

**Próximo passo:** Submeter para aprovação do PO/TL e iniciar Fase 0 imediatamente.
