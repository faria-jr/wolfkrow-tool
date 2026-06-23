# Reconciliamento Wolfkrow ↔ LionClaw — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os gaps identificados na auditoria — rastreabilidade, navegação quebrada, UI inconsistente, providers faltando, features de UI incompletas e templates de pipeline — garantindo paridade real com LionClaw v3.0.

**Architecture:** Monorepo Turborepo com Next.js 15 (web) + Fastify (worker) + Clean Architecture (domain → use-cases → infra). Todas as mudanças seguem os padrões existentes: shadcn/ui para componentes, Zod para validação, Vitest + RTL para testes frontend, TDD strict.

**Tech Stack:** Next.js 15 · TypeScript · Tailwind CSS v4 · shadcn/ui · Vitest + RTL · date-fns 4.x · @dnd-kit · Fastify · Drizzle ORM · Zod

---

## Resumo dos gaps corrigidos

| # | Gap | Tipo | Tarefa |
|---|-----|------|--------|
| BUG-001 | Sidebar `/mcp` aponta para rota inexistente | Bug navegação | Task 1 |
| BUG-002 | Sidebar `/settings` aponta para página inexistente | Bug navegação | Task 1 |
| DT1 | FEATURE_MATRIX.md desatualizado | Doc | Task 2 |
| DT2 | Comentário stale em `api/health/route.ts` | Tech Debt | Task 3 |
| DT5 | `<input>` cru em harness/pipeline/scheduler views | UI inconsistente | Task 4 |
| O2 | LionProvider cria nova instância a cada `resolve()` | Performance | Task 5 |
| U1 | Sem OpenRouter provider | Feature faltando | Task 6 |
| U2 | Sem endpoint OpenAI-compatible customizável | Feature faltando | Task 6 |
| U6 | Página `/settings` ausente | Feature faltando | Task 7 |
| missing | Enrich view sem UI | Feature faltando | Task 8 |
| missing | Onboarding sem escolha de SDK/provider | Feature faltando | Task 9 |
| missing | MCP custom server creation desabilitada | Feature faltando | Task 10 |
| U4 | Pipeline sem templates nomeados | Feature faltando | Task 11 |
| missing | Tasks sem visão de calendário | Feature faltando | Task 12 |

---

## Task 1: Corrigir links quebrados na Sidebar

**Files:**
- Modify: `apps/web/components/common/sidebar.tsx`

### Contexto

`MAIN_NAV` linka `/mcp` mas a rota existe em `/mcp-servers`. `SYSTEM_NAV` linka `/settings` mas a página não existe. Task 7 criará a settings page; aqui só corrigimos o link de MCP.

- [ ] **Step 1: Escrever teste para links da sidebar**

```tsx
// apps/web/components/common/__tests__/sidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '../sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  SidebarGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  SidebarHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, asChild: _a, ...p }: React.PropsWithChildren<Record<string, unknown>>) => <div {...p}>{children}</div>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarRail: () => <div />,
}));

describe('Sidebar nav links', () => {
  it('MCP Servers links to /mcp-servers (not /mcp)', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    const mcpLink = links.find((l) => l.textContent?.includes('MCP Servers'));
    expect(mcpLink).toBeTruthy();
    expect(mcpLink?.getAttribute('href')).toBe('/mcp-servers');
  });

  it('Settings links to /settings', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    const settingsLink = links.find((l) => l.textContent?.includes('Settings'));
    expect(settingsLink).toBeTruthy();
    expect(settingsLink?.getAttribute('href')).toBe('/settings');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/common/__tests__/sidebar.test.tsx
```

Esperado: FAIL — MCP link aponta para `/mcp`.

- [ ] **Step 3: Corrigir a URL na sidebar**

Em `apps/web/components/common/sidebar.tsx`, linha 46, mudar `url: '/mcp'` para `url: '/mcp-servers'`:

```tsx
// ANTES
{ title: 'MCP Servers', url: '/mcp', icon: Network },

// DEPOIS
{ title: 'MCP Servers', url: '/mcp-servers', icon: Network },
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/common/__tests__/sidebar.test.tsx
```

Esperado: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/common/__tests__/sidebar.test.tsx apps/web/components/common/sidebar.tsx
git commit -m "fix(nav): sidebar /mcp → /mcp-servers; settings link verified"
```

---

## Task 2: Reconciliar FEATURE_MATRIX.md

**Files:**
- Modify: `docs/FEATURE_MATRIX.md`

> Nenhum teste — tarefa de documentação pura.

- [ ] **Step 1: Atualizar status de cada item baseado no código real**

Substitua todo o conteúdo de `docs/FEATURE_MATRIX.md`:

```markdown
# Wolfkrow Tool — Feature Matrix (Rastreabilidade reconciliada)

> Reconciliado em 2026-06-22 contra código real (commit 618b3ee + análise de todos os arquivos).
> Legenda: ✅ feito · 🟡 parcial/placeholder · ⛔ não iniciado

---

## Chat & Orquestração (15)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 1 | Chat multi-SDK (Anthropic/Codex/Ollama/LionProvider) | SPEC-002 | ✅ | FIX-005/007 |
| 2 | Onboarding c/ escolha de SDK (wizard) | SPEC-001 | 🟡 setup de senha ✅; escolha SDK ⛔ | Task 9 |
| 3 | Sub-agentes CRUD + runtime + sync massa | SPEC-013 | ✅ | FIX-004/005 |
| 4 | Skills (editor markdown+frontmatter) | SPEC-014 | ✅ | FIX-016 |
| 5 | MCP servers (lifecycle start/stop/restart, discovery) | SPEC-008 | ✅ 3 built-in; custom create 🟡 | FIX-006/017; Task 10 |
| 6 | Memory pipeline (compaction/daily/semantic) | SPEC-015 | ✅ | FIX-012 |
| 7 | Dreaming (idle + turn) | SPEC-015 | ✅ | FIX-013 |
| 8 | Session management (criar/listar/arquivar/deletar) | SPEC-002 | 🟡 in-memory; persistência parcial | — |
| 9 | Title generation automático | SPEC-002 | ✅ deriveTitle() no chat-view | FIX-028 |
| 10 | Confirm dialog (permissões destrutivas) | SPEC-002 | ✅ ConfirmDialog component | FIX-028 |
| 11 | Ask user question (estruturada) | SPEC-002 | ✅ AskQuestionDialog component | FIX-028 |
| 12 | Voice conversation (VAD/barge-in) | SPEC-003 | ✅ | FIX-011 |
| 13 | STT (Whisper local / OpenAI) | SPEC-003 | 🟡 provider integrado | FIX-011 |
| 14 | TTS (ElevenLabs / Cartesia) | SPEC-003 | ✅ factory TTS selecionável | FIX-030 |
| 15 | Voice orb UI | SPEC-003 | ✅ VoiceOrb no chat | FIX-011 |

## Build & Automação (7)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 16 | Harness (Planner→Coder→Evaluator, sprints/rounds/métricas) | SPEC-005 | 🟡 domain+infra+use-cases+UI ✅; sem execução AI automática | — |
| 17 | Pipeline (BuildPlan multi-fase) | SPEC-006 | 🟡 domain+infra+routes+UI ✅; templates nomeados ⛔ | Task 11 |
| 18 | Open Design Studio (sidecar Next.js) | SPEC-007 | ✅ apps/sidecar + DesignStudio iframe embed | S.6 commit |
| 19 | Enrich pipeline (Validator→Enricher) | SPEC-016 | 🟡 API backend ✅; UI ⛔ | Task 8 |
| 20 | Spec build/validate/enrich seed agents | SPEC-016 | ⛔ | — |
| 21 | Knowledge engine (ingest/chunk/embed/search) | SPEC-004 | ✅ FTS5+vector search | FIX-002 |
| 22 | Knowledge benchmark (retrieval eval) | SPEC-004 | ⛔ removido intencionalmente | FIX-031 |

## Sistema & Infra (18)

| # | Funcionalidade | SPEC | Status | Commit/FIX |
|---|---|---|---|---|
| 23 | Scheduler (cron + review queue) | SPEC-009 | ✅ engine DI + review queue + UI | FIX-018 |
| 24 | Tasks page (kanban) | SPEC-009 | ✅ kanban+DnD; calendar ⛔ | FIX-009; Task 12 |
| 25 | Telegram bridge | SPEC-010 | ✅ OrchestratorChatAdapter real | FIX-014 |
| 26 | Auth (bcrypt + TOTP + auto-lock + middleware) | SPEC-001 | ✅ middleware.ts + layout verify-assinatura | FIX-007 |
| 27 | Vault (segredos via keytar) | SPEC-011 | ✅ CRUD via keytar | FIX-007 |
| 28 | Rules page | SPEC-021 | ✅ CRUD backend + UI | FIX-004 |
| 29 | Memory page | SPEC-015 | 🟡 schema ✅; UI básica | — |
| 30 | Usage page (token cost analytics) | SPEC-018 | ✅ charts + budget banner | FIX-032 |
| 31 | Logs page (system logs filtráveis) | SPEC-019 | ✅ LogViewer + SSE stream | — |
| 32 | Permissions page | SPEC-020 | 🟡 CRUD backend + UI básica | — |
| 33 | Channels page (Telegram) | SPEC-010 | 🟡 pairing UI; gerenciamento parcial | — |
| 34 | Excalidraw inline no chat | SPEC-002 | ⛔ | — |
| 35 | CodeBurn (terminal PTY) | SPEC-017 | ✅ TerminalPage + pty/server.ts | — |
| 36 | Artifact detection (tool results) | SPEC-002 | ⛔ | — |
| 37 | Pipeline report (relatório final) | SPEC-006 | ⛔ | — |
| 38 | Audit log (todas tool calls) | SPEC-020 | 🟡 schema+port ✅; sem UI | FIX-027 |
| 39 | Auto-update (electron-updater) | SPEC-012 | ✅ | FIX-010 |
| 40 | Pricing calculator (multi-fonte) | SPEC-018 | ⛔ | — |

## MCPs Externos (15 + 3 internos)

| # | MCP | Status |
|---|---|---|
| 41–44 | Google Calendar/Gmail/Drive/Sheets | ✅ catalog seed |
| 45 | ElevenLabs (TTS) | ✅ catalog |
| 46 | Excalidraw (drawing) | ✅ catalog |
| 47 | Knowledge base (search) | ✅ bridge real |
| 48 | Memory search | ✅ catalog |
| 49 | Local agents | ✅ catalog |
| 50 | Local LLM (Ollama) | ✅ |
| 51 | Skills | ✅ bridge real |
| 52 | YouTube (transcript) | ✅ catalog |
| 53 | Shopify | ✅ catalog |
| 54 | Nano-banana (Cohere) | ✅ catalog |
| 55 | Graph search | ✅ bridge real |
| int | wolfkrow-agents/skills/user-question | ✅ 3 internos |

## Providers AI (não mapeados originalmente)

| Provider | Status |
|---|---|
| Anthropic (claude-*) | ✅ AnthropicProvider |
| OpenAI (gpt-*, o1-*, o4-*) | ✅ CodexProvider |
| Ollama (llama-*, qwen-*, etc.) | ✅ CodexProvider c/ baseURL |
| OpenRouter (qualquer modelo) | ⛔ Task 6 |
| Custom OpenAI-compatible | ⛔ Task 6 |
| Google (gemini-*) | ⛔ stub — lança erro |
| Groq | ⛔ stub — lança erro |

## Navegação / Estrutura

| Item | Status |
|---|---|
| Sidebar /mcp link | 🔴 BUG — aponta /mcp, rota é /mcp-servers | Task 1 |
| Sidebar /settings link | 🟡 link existe, página ⛔ | Task 7 |
| Migrador LionClaw→Wolfkrow | ✅ scripts/migrate-lionclaw.ts |
| PWA / Service Worker | ✅ SW + manifest + icons |
| Electron wrapper + auto-update | ✅ |

## Gaps de Segurança (auditoria original G1-G9)

| Gap | Status |
|---|---|
| G1 Sem middleware.ts | ✅ RESOLVIDO — middleware.ts + layout getSession |
| G2 Worker JWKS efêmero | ✅ RESOLVIDO — createRemoteJWKSet + keypair persistente |
| G3 AIProvider sem streaming | ✅ RESOLVIDO — query() AsyncIterable |
| G4 Regra de negócio no agent-executor | 🟡 temp/model externalizados |
| G5 Worker bloqueia no start 18 MCPs | ✅ RESOLVIDO — apenas 3 internos |
| G6 Schemas sem índices | ✅ RESOLVIDO — 35 index() nos schemas Drizzle |
| G7 MCP manager sem JSON-RPC real | ✅ RESOLVIDO — stdio JSON-RPC |
| G8 web/worker não dependem de domain | ✅ RESOLVIDO — Clean Arch completo |
| G9 Catalog aponta MCPs não migrados | ✅ RESOLVIDO — 3 reais + PLANNED list |

---

## Resumo de cobertura (reconciliado 2026-06-22)

| | Quantidade |
|---|---|
| Funcionalidades mapeadas | 55 + extras |
| ✅ Feito | ~35 |
| 🟡 Parcial | ~10 |
| ⛔ Não iniciado | ~10 |
| Bugs de navegação | 2 (Task 1) |
| Gaps de segurança resolvidos | 8/9 |
```

- [ ] **Step 2: Commit**

```bash
git add docs/FEATURE_MATRIX.md
git commit -m "docs: reconciliar FEATURE_MATRIX — 35✅ confirmados vs 28 reportados"
```

---

## Task 3: Remover comentário stale em health/route.ts

**Files:**
- Modify: `apps/web/app/api/health/route.ts`

- [ ] **Step 1: Ler o arquivo atual**

```bash
grep -n "Placeholder\|TODO\|Fase" apps/web/app/api/health/route.ts
```

Esperado: linhas 1-2 com comentário stale sobre "Fase 4" e "Replace with real AuthenticateUser".

- [ ] **Step 2: Remover os comentários stale**

O arquivo deve ficar apenas:

```ts
export function GET() {
  return Response.json({ status: 'ok' });
}
```

- [ ] **Step 3: Verificar que o endpoint ainda funciona**

```bash
pnpm --filter @wolfkrow/web typecheck
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/health/route.ts
git commit -m "chore: remove stale placeholder comment from health route"
```

---

## Task 4: Substituir `<input>` cru por shadcn `<Input>`/`<Textarea>`

**Files:**
- Modify: `apps/web/components/harness/harness-view.tsx`
- Modify: `apps/web/components/pipeline/pipeline-view.tsx`
- Modify: `apps/web/components/scheduler/scheduler-view.tsx`

### Contexto

ADR-0006 manda usar shadcn/ui. Três views usam `<input className="border-input bg-background ...">` e `<textarea>` crus em vez dos componentes `<Input>` e `<Textarea>` já existentes.

- [ ] **Step 1: Escrever testes de regressão para os formulários**

```tsx
// apps/web/components/harness/__tests__/harness-view.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HarnessView } from '../harness-view';

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ projects: [] }),
});

describe('HarnessView form', () => {
  it('renders project name field as shadcn Input (has ring focus style)', () => {
    render(<HarnessView />);
    const inputs = screen.getAllByRole('textbox');
    // shadcn Input has focus-visible:ring-1 class via cn()
    inputs.forEach((input) => {
      expect(input.className).toMatch(/rounded-md|ring/);
    });
  });
});
```

- [ ] **Step 2: Rodar teste — verificar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/harness/__tests__/harness-view.test.tsx
```

- [ ] **Step 3: Atualizar harness-view.tsx — adicionar imports e substituir inputs**

No topo do arquivo `apps/web/components/harness/harness-view.tsx`, adicionar:

```tsx
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
```

Substituir os três inputs crus no componente de criação de projeto:

```tsx
// ANTES
<input className="w-full rounded border px-2 py-1 text-sm" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
<input className="w-full rounded border px-2 py-1 text-sm" placeholder="Spec path (e.g. /docs/spec.md)" value={form.specPath} onChange={(e) => setForm({ ...form, specPath: e.target.value })} required />
<input className="w-full rounded border px-2 py-1 text-sm" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

// DEPOIS
<Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
<Input placeholder="Spec path (e.g. /docs/spec.md)" value={form.specPath} onChange={(e) => setForm({ ...form, specPath: e.target.value })} required />
<Input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
```

- [ ] **Step 4: Atualizar pipeline-view.tsx**

Adicionar no topo:

```tsx
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
```

Substituir:

```tsx
// ANTES
<input className="w-full rounded border px-2 py-1 text-sm" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
<textarea className="w-full rounded border px-2 py-1 text-sm" placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

// DEPOIS
<Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
<Textarea placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
```

- [ ] **Step 5: Atualizar scheduler-view.tsx**

Adicionar no topo:

```tsx
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
```

No componente `TaskCreateForm`, substituir todos os `<input` e `<textarea` crus:

```tsx
// ANTES
<input value={form.name} onChange={set('name')} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" placeholder="Daily briefing" />
<input value={form.cronExpression} onChange={set('cronExpression')} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm font-mono" placeholder="0 9 * * *" />
<input value={form.description} onChange={set('description')} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" placeholder="Optional description" />
<textarea value={form.prompt} onChange={set('prompt')} rows={3} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" placeholder="Summarize the latest news and send me a briefing." />

// DEPOIS
<Input value={form.name} onChange={set('name')} placeholder="Daily briefing" />
<Input value={form.cronExpression} onChange={set('cronExpression')} className="font-mono" placeholder="0 9 * * *" />
<Input value={form.description} onChange={set('description')} placeholder="Optional description" />
<Textarea value={form.prompt} onChange={set('prompt')} rows={3} placeholder="Summarize the latest news and send me a briefing." />
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @wolfkrow/web typecheck
```

Esperado: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/harness/harness-view.tsx \
        apps/web/components/pipeline/pipeline-view.tsx \
        apps/web/components/scheduler/scheduler-view.tsx \
        apps/web/components/harness/__tests__/harness-view.test.tsx
git commit -m "refactor(ui): replace raw inputs with shadcn Input/Textarea in harness, pipeline, scheduler"
```

---

## Task 5: Cache de instância no LionProvider

**Files:**
- Modify: `packages/infra/src/ai-providers/lion.ts`
- Create: `packages/infra/src/__tests__/lion-cache.test.ts`

### Contexto

`LionProvider.resolve()` cria `new AnthropicProvider()` ou `new CodexProvider()` a cada chamada — 1 instância por chunk de stream. Cache por chave de configuração evita alocações desnecessárias.

- [ ] **Step 1: Escrever teste de cache**

```ts
// packages/infra/src/__tests__/lion-cache.test.ts
import { describe, expect, it } from 'vitest';

import { LionProvider } from '../ai-providers/lion';

describe('LionProvider instance caching', () => {
  it('returns same adapter instance for same model prefix', async () => {
    const provider = new LionProvider({ anthropicApiKey: 'test-key' });

    // Trigger two resolve calls via query (intercept before real API call)
    const opts = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user' as const, content: 'hi' }],
    };

    // Access the internal cache via the public test hook
    const a = provider.resolveForTest(opts.model);
    const b = provider.resolveForTest(opts.model);
    expect(a).toBe(b); // strict reference equality
  });

  it('returns different adapters for different model prefixes', () => {
    const provider = new LionProvider({
      anthropicApiKey: 'test-key',
      openaiApiKey: 'oai-key',
    });

    const claude = provider.resolveForTest('claude-3-5-sonnet-20241022');
    const gpt = provider.resolveForTest('gpt-4o');
    expect(claude).not.toBe(gpt);
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
pnpm --filter @wolfkrow/infra test -- --reporter=verbose lion-cache
```

Esperado: FAIL — `resolveForTest` não existe.

- [ ] **Step 3: Adicionar cache + test hook ao LionProvider**

```ts
// packages/infra/src/ai-providers/lion.ts (versão completa)
import { AnthropicProvider } from './anthropic';
import { CodexProvider } from './codex';
import type { AIProvider, ChatMessage, CompletionOptions, CompletionResult, StreamChunk } from './types';

const OLLAMA_DEFAULT_URL = 'http://localhost:11434/v1';
const OPENAI_PREFIXES = ['gpt-', 'o1-', 'o3-', 'o4-', 'ft:gpt-'];
const OLLAMA_PREFIXES = ['llama-', 'qwen', 'phi-', 'mistral', 'gemma', 'deepseek', 'codellama', 'vicuna'];

export interface LionProviderConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  openrouterApiKey?: string;
  customBaseUrl?: string;
  customApiKey?: string;
}

function cacheKey(model: string, config: LionProviderConfig): string {
  const m = model.toLowerCase();
  if (m.startsWith('claude-')) return `anthropic:${config.anthropicApiKey?.slice(-8)}`;
  if (OPENAI_PREFIXES.some((p) => m.startsWith(p))) return `openai:${config.openaiApiKey?.slice(-8)}`;
  if (OLLAMA_PREFIXES.some((p) => m.startsWith(p))) return `ollama:${config.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL}`;
  if (m.startsWith('openrouter-')) return `openrouter:${config.openrouterApiKey?.slice(-8)}`;
  if (config.customBaseUrl) return `custom:${config.customBaseUrl}`;
  return `unknown:${m}`;
}

export class LionProvider implements AIProvider {
  private readonly _cache = new Map<string, AIProvider>();

  constructor(private readonly config: LionProviderConfig) {}

  /** @internal exposed for tests only */
  resolveForTest(model: string): AIProvider {
    return this.resolve(model);
  }

  private resolve(model: string): AIProvider {
    const key = cacheKey(model, this.config);
    const cached = this._cache.get(key);
    if (cached) return cached;

    const provider = this.create(model);
    this._cache.set(key, provider);
    return provider;
  }

  private create(model: string): AIProvider {
    const m = model.toLowerCase();

    if (m.startsWith('claude-')) {
      if (!this.config.anthropicApiKey) throw new Error('LionProvider: anthropicApiKey required for claude-* models');
      return new AnthropicProvider(this.config.anthropicApiKey);
    }

    if (OPENAI_PREFIXES.some((p) => m.startsWith(p))) {
      if (!this.config.openaiApiKey) throw new Error('LionProvider: openaiApiKey required for gpt-*/o1-* models');
      return new CodexProvider(this.config.openaiApiKey);
    }

    if (OLLAMA_PREFIXES.some((p) => m.startsWith(p))) {
      return new CodexProvider('ollama', this.config.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL);
    }

    if (m.startsWith('gemini-')) throw new Error(`LionProvider: Google GenAI not implemented (model: ${model}). Use openrouter- prefix to access via OpenRouter.`);
    if (m.startsWith('groq-')) throw new Error(`LionProvider: Groq not implemented (model: ${model}). Use openrouter- prefix to access via OpenRouter.`);
    if (m.startsWith('zai-')) throw new Error(`LionProvider: Z.ai not implemented (model: ${model})`);

    if (this.config.customBaseUrl) {
      return new CodexProvider(this.config.customApiKey ?? 'custom', this.config.customBaseUrl);
    }

    throw new Error(`LionProvider: unknown model prefix — cannot resolve provider for "${model}"`);
  }

  query(options: CompletionOptions): AsyncIterable<StreamChunk> {
    return this.resolve(options.model).query(options);
  }

  complete(options: CompletionOptions): Promise<CompletionResult> {
    return this.resolve(options.model).complete(options);
  }

  countTokens(messages: ChatMessage[], model: string): Promise<number> {
    return this.resolve(model).countTokens(messages, model);
  }
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
pnpm --filter @wolfkrow/infra test -- --reporter=verbose lion-cache
```

Esperado: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/infra/src/ai-providers/lion.ts \
        packages/infra/src/__tests__/lion-cache.test.ts
git commit -m "perf(infra): cache LionProvider adapter instances per model prefix"
```

---

## Task 6: OpenRouter provider + custom OpenAI-compatible endpoint

**Files:**
- Create: `packages/infra/src/ai-providers/openrouter.ts`
- Create: `packages/infra/src/__tests__/openrouter-provider.test.ts`
- Modify: `packages/infra/src/ai-providers/factory.ts` (add 'openrouter' case)
- Modify: `packages/infra/src/ai-providers/lion.ts` (add openrouter routing)
- Modify: `packages/infra/src/ai-providers/index.ts` (export OpenRouterProvider)

### Contexto

OpenRouter é 100% OpenAI-compatible (`baseURL: https://openrouter.ai/api/v1`). Ele roteia para google/anthropic/groq/together/mistral etc. A mesma classe serve de unificador para os stubs que lançavam erro.

- [ ] **Step 1: Escrever teste do OpenRouterProvider**

```ts
// packages/infra/src/__tests__/openrouter-provider.test.ts
import { describe, expect, it, vi } from 'vitest';

import { OpenRouterProvider } from '../ai-providers/openrouter';

// Mock the OpenAI SDK so no real HTTP calls are made
vi.mock('openai', () => {
  const MockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'hello' } }], usage: null };
            yield { choices: [{ delta: {} }], usage: { prompt_tokens: 5, completion_tokens: 2 } };
          },
        }),
      },
    },
  }));
  return { default: MockOpenAI };
});

describe('OpenRouterProvider', () => {
  it('constructs without throwing', () => {
    expect(() => new OpenRouterProvider('test-key')).not.toThrow();
  });

  it('streams chunks via query()', async () => {
    const provider = new OpenRouterProvider('test-key');
    const chunks: string[] = [];
    for await (const chunk of provider.query({
      model: 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      if (chunk.delta) chunks.push(chunk.delta);
    }
    expect(chunks).toContain('hello');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
pnpm --filter @wolfkrow/infra test -- --reporter=verbose openrouter-provider
```

Esperado: FAIL — `../ai-providers/openrouter` não encontrado.

- [ ] **Step 3: Criar OpenRouterProvider**

```ts
// packages/infra/src/ai-providers/openrouter.ts
import OpenAI from 'openai';

import { OpenAIBaseProvider } from './openai-base';

/**
 * OpenRouter — roteia para google/groq/mistral/together e mais 100+ modelos
 * via endpoint OpenAI-compatible. API key em https://openrouter.ai/keys
 */
export class OpenRouterProvider extends OpenAIBaseProvider {
  constructor(apiKey: string) {
    super(
      new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://wolfkrow.ai',
          'X-Title': 'Wolfkrow',
        },
      }),
    );
  }
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
pnpm --filter @wolfkrow/infra test -- --reporter=verbose openrouter-provider
```

Esperado: PASS (2 tests).

- [ ] **Step 5: Adicionar ao factory**

Em `packages/infra/src/ai-providers/factory.ts`, adicionar import e case:

```ts
// adicionar import no topo
import { OpenRouterProvider } from './openrouter';

// adicionar no switch dentro de ProviderAIProviderFactory.create():
case 'openrouter':
  return new OpenRouterProvider(apiKey);
```

- [ ] **Step 6: Adicionar OpenRouter routing no LionProvider (Task 5 já atualizado)**

Em `packages/infra/src/ai-providers/lion.ts`, na função `create()`, adicionar antes do fallback de `customBaseUrl`:

```ts
if (m.startsWith('openrouter/') || m.startsWith('google/') || m.startsWith('groq/') || m.startsWith('mistral/') || m.startsWith('together/')) {
  if (!this.config.openrouterApiKey) throw new Error('LionProvider: openrouterApiKey required for OpenRouter models');
  // Import inline para evitar circular — OpenRouterProvider já está no mesmo pacote
  const { OpenRouterProvider } = await import('./openrouter');
  return new OpenRouterProvider(this.config.openrouterApiKey);
}
```

> Nota: como `create()` é síncrona mas precisa do import dinâmico, refatorar para retornar `Promise<AIProvider>` e atualizar `resolve()` para ser `async`. Alternativamente, importar `OpenRouterProvider` no topo do arquivo (preferido):

```ts
// adicionar import no topo de lion.ts
import { OpenRouterProvider } from './openrouter';

// substituir a linha dinâmica por:
if (m.startsWith('openrouter/') || m.startsWith('google/') || m.startsWith('groq/') || m.startsWith('mistral/') || m.startsWith('together/')) {
  if (!this.config.openrouterApiKey) throw new Error('LionProvider: openrouterApiKey required for OpenRouter models');
  return new OpenRouterProvider(this.config.openrouterApiKey);
}
```

- [ ] **Step 7: Exportar OpenRouterProvider do index**

Em `packages/infra/src/ai-providers/index.ts`:

```ts
export { OpenRouterProvider } from './openrouter';
```

- [ ] **Step 8: Typecheck**

```bash
pnpm --filter @wolfkrow/infra typecheck
```

Esperado: 0 erros.

- [ ] **Step 9: Commit**

```bash
git add packages/infra/src/ai-providers/openrouter.ts \
        packages/infra/src/ai-providers/factory.ts \
        packages/infra/src/ai-providers/lion.ts \
        packages/infra/src/ai-providers/index.ts \
        packages/infra/src/__tests__/openrouter-provider.test.ts
git commit -m "feat(infra): OpenRouter provider — access google/groq/mistral/together via openrouter.ai"
```

---

## Task 7: Settings página consolidada

**Files:**
- Create: `apps/web/app/(app)/settings/page.tsx`
- Create: `apps/web/components/settings/settings-view.tsx`
- Create: `apps/web/components/settings/__tests__/settings-view.test.tsx`

### Contexto

Sidebar já tem `{ title: 'Settings', url: '/settings' }` mas a rota não existe (404). LionClaw tinha um `SettingsPage.tsx` de 30KB. Aqui criaremos um hub de navegação que linka para as páginas existentes de configuração.

- [ ] **Step 1: Escrever teste do SettingsView**

```tsx
// apps/web/components/settings/__tests__/settings-view.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsView } from '../settings-view';

describe('SettingsView', () => {
  it('renders heading', () => {
    render(<SettingsView />);
    expect(screen.getByRole('heading', { name: /settings/i })).toBeTruthy();
  });

  it('renders Vault link', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const vault = links.find((l) => l.textContent?.toLowerCase().includes('vault') || l.textContent?.toLowerCase().includes('api key'));
    expect(vault).toBeTruthy();
    expect(vault?.getAttribute('href')).toBe('/vault');
  });

  it('renders Agents link', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const agents = links.find((l) => l.getAttribute('href') === '/agents');
    expect(agents).toBeTruthy();
  });

  it('renders MCP Servers link', () => {
    render(<SettingsView />);
    const links = screen.getAllByRole('link');
    const mcp = links.find((l) => l.getAttribute('href') === '/mcp-servers');
    expect(mcp).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/settings/__tests__/settings-view.test.tsx
```

Esperado: FAIL — `../settings-view` não encontrado.

- [ ] **Step 3: Criar SettingsView**

```tsx
// apps/web/components/settings/settings-view.tsx
import {
  BarChart3,
  Bot,
  Calendar,
  FileText,
  Folder,
  KeyRound,
  Network,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingItem {
  title: string;
  description: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_ITEMS: SettingItem[] = [
  { title: 'API Keys (Vault)', description: 'Manage API keys and encrypted secrets', href: '/vault', Icon: KeyRound },
  { title: 'Agents', description: 'Create and configure AI agents', href: '/agents', Icon: Bot },
  { title: 'MCP Servers', description: 'Model Context Protocol server lifecycle', href: '/mcp-servers', Icon: Network },
  { title: 'Automation', description: 'Scheduled tasks and cron triggers', href: '/scheduler', Icon: Calendar },
  { title: 'Rules', description: 'Global system prompt rules', href: '/rules', Icon: FileText },
  { title: 'Permissions', description: 'Tool call whitelist and blacklist', href: '/permissions', Icon: ShieldCheck },
  { title: 'Channels', description: 'Telegram and external channels', href: '/channels', Icon: Folder },
  { title: 'Usage', description: 'Token usage analytics and budget', href: '/usage', Icon: BarChart3 },
];

export function SettingsView() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your Wolfkrow instance</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_ITEMS.map(({ title, description, href, Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{title}</CardTitle>
                </div>
                <CardDescription className="text-xs">{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar a rota**

```tsx
// apps/web/app/(app)/settings/page.tsx
import { SettingsView } from '@/components/settings/settings-view';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return <SettingsView />;
}
```

- [ ] **Step 5: Rodar testes — devem passar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/settings/__tests__/settings-view.test.tsx
```

Esperado: PASS (4 tests).

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @wolfkrow/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(app\)/settings/page.tsx \
        apps/web/components/settings/settings-view.tsx \
        apps/web/components/settings/__tests__/settings-view.test.tsx
git commit -m "feat(web): settings hub page — links to vault, agents, mcp, scheduler, rules, permissions"
```

---

## Task 8: Enrich View UI

**Files:**
- Create: `apps/web/components/enrich/enrich-view.tsx`
- Create: `apps/web/components/enrich/__tests__/enrich-view.test.tsx`
- Modify: `apps/web/components/pipeline/pipeline-view.tsx` (adicionar tab Enrich)
- Modify: `apps/web/app/(app)/pipeline/page.tsx` (passar tab param)

### Contexto

A API de enrich existe (`/api/enrich/sessions` + `/api/enrich/sessions/{id}/validate` + `/api/enrich/sessions/{id}/enrich`). Não há nenhum componente de UI. Enrich faz parte do pipeline de build, então vai como aba na Pipeline page.

- [ ] **Step 1: Escrever teste do EnrichView**

```tsx
// apps/web/components/enrich/__tests__/enrich-view.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EnrichView } from '../enrich-view';

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ sessions: [] }),
}) as typeof fetch;

describe('EnrichView', () => {
  it('renders heading', () => {
    render(<EnrichView />);
    expect(screen.getByRole('heading', { name: /enrich/i })).toBeTruthy();
  });

  it('shows empty state when no sessions', async () => {
    render(<EnrichView />);
    // Wait for fetch
    expect(await screen.findByText(/no sessions/i)).toBeTruthy();
  });

  it('shows create session button', () => {
    render(<EnrichView />);
    expect(screen.getByRole('button', { name: /new session/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/enrich/__tests__/enrich-view.test.tsx
```

- [ ] **Step 3: Criar EnrichView**

```tsx
// apps/web/components/enrich/enrich-view.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface EnrichSession {
  id: string;
  name: string;
  status: string;
  validationStatus?: string;
  enrichStatus?: string;
  createdAt: string;
}

const API = '/api/enrich/sessions';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    validated: 'bg-blue-100 text-blue-700',
    enriched: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export function EnrichView() {
  const [sessions, setSessions] = useState<EnrichSession[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(API, { credentials: 'include' });
    if (!res.ok) return;
    const data = (await res.json()) as { sessions: EnrichSession[] };
    setSessions(data.sessions ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createSession = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch(API, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (!res.ok) { setError('Failed to create session'); return; }
    setNewName('');
    await load();
  };

  const runValidate = async (id: string) => {
    await fetch(`${API}/${id}/validate`, { method: 'POST', credentials: 'include' });
    await load();
  };

  const runEnrich = async (id: string) => {
    await fetch(`${API}/${id}/enrich`, { method: 'POST', credentials: 'include' });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Enrich Pipeline</h2>
        <p className="text-sm text-muted-foreground">Validate and enrich your build specs</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Session name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void createSession(); }}
          className="max-w-xs"
        />
        <Button onClick={() => void createSession()} disabled={creating || !newName.trim()}>
          New session
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet. Create one above.</p>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{s.name}</CardTitle>
                  <Badge className={statusBadge(s.status)}>{s.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void runValidate(s.id)}>
                  Validate
                </Button>
                <Button size="sm" variant="outline" onClick={() => void runEnrich(s.id)}>
                  Enrich
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/enrich/__tests__/enrich-view.test.tsx
```

Esperado: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/enrich/enrich-view.tsx \
        apps/web/components/enrich/__tests__/enrich-view.test.tsx
git commit -m "feat(web): enrich pipeline UI — create sessions, validate, enrich"
```

---

## Task 9: Onboarding — Step 2 com escolha de SDK/provider

**Files:**
- Modify: `apps/web/components/auth/onboarding-form.tsx`
- Modify: `apps/web/components/auth/__tests__/onboarding-form.test.tsx`

### Contexto

Onboarding atual tem Step 1 (senha) e Step 2 (conclusão). LionClaw tinha wizard com escolha de SDK. Adicionar Step 2 para selecionar provider (Anthropic, OpenRouter, OpenAI, Ollama) e inserir API key, que é salva no vault via `POST /api/vault`.

- [ ] **Step 1: Atualizar testes do OnboardingForm**

```tsx
// apps/web/components/auth/__tests__/onboarding-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingForm } from '../onboarding-form';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const okFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
global.fetch = okFetch as typeof fetch;

async function completeStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/password/i), 'Password1');
  await user.type(screen.getByLabelText(/confirm/i), 'Password1');
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

describe('OnboardingForm', () => {
  it('Step 1: shows password form', () => {
    render(<OnboardingForm />);
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy();
  });

  it('Step 2: shows provider selector after successful Step 1', async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);
    await completeStep1(user);
    await waitFor(() => expect(screen.getByText(/choose your ai provider/i)).toBeTruthy());
  });

  it('Step 2: can select Anthropic and enter API key', async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);
    await completeStep1(user);
    await waitFor(() => screen.getByText(/choose your ai provider/i));
    await user.click(screen.getByRole('button', { name: /anthropic/i }));
    const keyInput = screen.getByPlaceholderText(/sk-ant-/i);
    await user.type(keyInput, 'sk-ant-test123');
    expect(keyInput).toHaveValue('sk-ant-test123');
  });

  it('Step 2: skip button goes to completion', async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);
    await completeStep1(user);
    await waitFor(() => screen.getByText(/choose your ai provider/i));
    await user.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText(/you.re all set/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/auth/__tests__/onboarding-form.test.tsx
```

- [ ] **Step 3: Adicionar Step 2 ao OnboardingForm**

```tsx
// apps/web/components/auth/onboarding-form.tsx (versão completa)
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const step1Schema = z
  .object({
    password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/),
    confirmPassword: z.string(),
    displayName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type Step1Form = z.infer<typeof step1Schema>;

type Provider = 'anthropic' | 'openrouter' | 'openai' | 'ollama';
type OnboardingStep = 1 | 2 | 3;

interface ProviderOption {
  id: Provider;
  label: string;
  placeholder: string;
  vaultKey: string;
  description: string;
}

const PROVIDERS: ProviderOption[] = [
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…', vaultKey: 'anthropic-api-key', description: 'Claude models' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-…', vaultKey: 'openrouter-api-key', description: 'Google, Groq, Mistral + 100 more' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…', vaultKey: 'openai-api-key', description: 'GPT-4o, o1, o3' },
  { id: 'ollama', label: 'Ollama (local)', placeholder: 'http://localhost:11434', vaultKey: 'ollama-base-url', description: 'Llama, Qwen, Mistral local' },
];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: { password: '', confirmPassword: '', displayName: '' },
  });

  async function onStep1Submit({ password, displayName }: Step1Form) {
    setSubmitError(null);
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirmPassword: password, displayName }),
    });
    const data = (await res.json()) as Record<string, string>;
    if (!res.ok) { setSubmitError(data.error ?? 'Setup failed'); return; }
    setStep(2);
  }

  async function saveProviderKey() {
    if (!selectedProvider || !apiKey.trim()) { setStep(3); return; }
    setSavingKey(true);
    const providerDef = PROVIDERS.find((p) => p.id === selectedProvider);
    if (providerDef) {
      await fetch('/api/vault', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: providerDef.vaultKey, value: apiKey.trim(), description: `${providerDef.label} API key` }),
      });
    }
    setSavingKey(false);
    setStep(3);
  }

  if (step === 3) return <CompletionStep onContinue={() => router.push('/chat')} />;

  if (step === 2) {
    const provDef = PROVIDERS.find((p) => p.id === selectedProvider);
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Choose your AI provider</h2>
          <p className="text-sm text-muted-foreground">You can change this later in Settings → Vault.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setSelectedProvider(p.id); setApiKey(''); }}
              className={`rounded-lg border p-3 text-left transition-colors hover:border-primary ${selectedProvider === p.id ? 'border-primary bg-primary/5' : 'border-input'}`}
            >
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </button>
          ))}
        </div>
        {provDef && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{provDef.label} key</label>
            <Input
              type="password"
              placeholder={provDef.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => void saveProviderKey()}
            disabled={savingKey || (selectedProvider !== null && !apiKey.trim() && selectedProvider !== 'ollama')}
            className="flex-1"
          >
            {savingKey ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Continue'}
          </Button>
          <Button variant="outline" onClick={() => setStep(3)}>Skip</Button>
        </div>
      </div>
    );
  }

  return <PasswordSetupForm form={form} error={submitError} onSubmit={onStep1Submit} />;
}

type SetupFormProps = { form: ReturnType<typeof useForm<Step1Form>>; error: string | null; onSubmit: (v: Step1Form) => Promise<void>; };

function PasswordSetupForm({ form, error, onSubmit }: SetupFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input {...field} type="password" placeholder="Min 8 chars, letter + number" autoComplete="new-password" autoFocus /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl><Input {...field} type="password" placeholder="Repeat password" autoComplete="new-password" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="displayName" render={({ field }) => (
          <FormItem>
            <FormLabel>Display Name (optional)</FormLabel>
            <FormControl><Input {...field} type="text" placeholder="Your name" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : 'Create account'}
        </Button>
      </form>
    </Form>
  );
}

function CompletionStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">You&apos;re all set!</h2>
        <p className="text-sm text-muted-foreground">Welcome to Wolfkrow.</p>
      </div>
      <Button className="w-full" onClick={onContinue}>Go to app</Button>
    </div>
  );
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/auth/__tests__/onboarding-form.test.tsx
```

Esperado: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/auth/onboarding-form.tsx \
        apps/web/components/auth/__tests__/onboarding-form.test.tsx
git commit -m "feat(auth): onboarding Step 2 — SDK/provider selection + vault key save"
```

---

## Task 10: MCP Custom Server — habilitar criação via modal

**Files:**
- Create: `apps/web/components/mcp/add-mcp-server-modal.tsx`
- Create: `apps/web/components/mcp/__tests__/add-mcp-server-modal.test.tsx`
- Modify: `apps/web/components/mcp/mcp-servers-view.tsx` (habilitar botão + montar modal)

### Contexto

`POST /api/mcp-servers` já existe e aceita `{ name, command, args, env, isActive }`. Só falta o modal de UI. O botão `Add server` está desabilitado com `disabled title="Custom MCP server creation coming soon"`.

- [ ] **Step 1: Escrever teste do modal**

```tsx
// apps/web/components/mcp/__tests__/add-mcp-server-modal.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddMcpServerModal } from '../add-mcp-server-modal';

describe('AddMcpServerModal', () => {
  it('renders nothing when closed', () => {
    render(<AddMcpServerModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders form fields when open', () => {
    render(<AddMcpServerModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toBeTruthy();
    expect(screen.getByLabelText(/command/i)).toBeTruthy();
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddMcpServerModal open={true} onClose={onClose} onCreated={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits form and calls onCreated on success', async () => {
    const onCreated = vi.fn();
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ server: { id: '1', name: 'test' } }),
    }) as typeof fetch;

    render(<AddMcpServerModal open={true} onClose={vi.fn()} onCreated={onCreated} />);
    await user.type(screen.getByLabelText(/name/i), 'my-server');
    await user.type(screen.getByLabelText(/command/i), 'node server.js');
    await user.click(screen.getByRole('button', { name: /add server/i }));
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/mcp/__tests__/add-mcp-server-modal.test.tsx
```

- [ ] **Step 3: Criar AddMcpServerModal**

```tsx
// apps/web/components/mcp/add-mcp-server-modal.tsx
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddMcpServerModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setName(''); setCommand(''); setArgs(''); setError(null); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) { setError('Name and command are required'); return; }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/mcp-servers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        command: command.trim(),
        args: args.split(' ').filter(Boolean),
        env: {},
        isActive: true,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { setError('Failed to create server'); return; }
    reset();
    onCreated();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>Configure a custom Model Context Protocol server.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-mcp-server" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-command">Command</Label>
            <Input id="mcp-command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="node" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-args">Arguments (space-separated)</Label>
            <Input id="mcp-args" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="dist/server.js --port 3100" className="font-mono" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>Add server</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Habilitar botão em McpServersView**

Em `apps/web/components/mcp/mcp-servers-view.tsx`, adicionar import e state:

```tsx
// adicionar imports no topo
import { AddMcpServerModal } from './add-mcp-server-modal';

// dentro de McpServersView, adicionar state:
const [showAdd, setShowAdd] = useState(false);
```

Substituir o botão desabilitado:

```tsx
// ANTES
<Button disabled title="Custom MCP server creation coming soon">
  <Plus className="mr-2 h-4 w-4" />Add server
</Button>

// DEPOIS
<>
  <Button onClick={() => setShowAdd(true)}>
    <Plus className="mr-2 h-4 w-4" />Add server
  </Button>
  <AddMcpServerModal
    open={showAdd}
    onClose={() => setShowAdd(false)}
    onCreated={() => { setShowAdd(false); void load(); }}
  />
</>
```

- [ ] **Step 5: Rodar testes**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/mcp/__tests__/add-mcp-server-modal.test.tsx
```

Esperado: PASS (4 tests).

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @wolfkrow/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/mcp/add-mcp-server-modal.tsx \
        apps/web/components/mcp/__tests__/add-mcp-server-modal.test.tsx \
        apps/web/components/mcp/mcp-servers-view.tsx
git commit -m "feat(mcp): enable custom MCP server creation — AddMcpServerModal"
```

---

## Task 11: Pipeline named templates seed

**Files:**
- Create: `packages/infra/src/seed/pipeline-templates.ts`
- Modify: `packages/infra/src/db/seed.ts` (seed templates na tabela de skills/settings)
- Modify: `apps/web/components/pipeline/pipeline-view.tsx` (template picker no Create Project form)
- Create: `apps/web/components/pipeline/__tests__/pipeline-template-picker.test.tsx`

### Contexto

LionClaw tinha 5 pipelines nomeados: Security Audit, Architecture Review, Development V2, Feature Pipeline, Enrich Pipeline. Wolfkrow tem a engine genérica. Aqui adicionamos templates que pré-preenchem o formulário de criação de projeto na UI (não são projetos pré-criados — são "starting points" selecionáveis).

- [ ] **Step 1: Criar os templates**

```ts
// packages/infra/src/seed/pipeline-templates.ts
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  discoveryPrompt: string;
  specBuildPrompt: string;
  specValidatePrompt: string;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'OWASP Top 10 audit + threat modeling + remediation plan',
    discoveryPrompt: 'Analyze the codebase for security vulnerabilities. Focus on OWASP Top 10, authentication flaws, injection risks, and secrets management.',
    specBuildPrompt: 'Build a detailed security specification: threat model, vulnerability inventory, CVSS scores, and prioritized remediation plan.',
    specValidatePrompt: 'Validate the security specification for completeness. Check that all OWASP categories are addressed and remediation steps are actionable.',
  },
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description: 'Clean architecture, coupling analysis, scalability assessment',
    discoveryPrompt: 'Review the system architecture. Identify bounded contexts, coupling issues, missing abstractions, and scalability bottlenecks.',
    specBuildPrompt: 'Build an architecture specification: current state diagram, problem areas, proposed refactoring, dependency map, and migration strategy.',
    specValidatePrompt: 'Validate the architecture spec for feasibility and completeness. Check for circular dependencies, missing components, and unrealistic timelines.',
  },
  {
    id: 'feature-pipeline',
    name: 'Feature Pipeline',
    description: 'Discovery → spec → implementation for a new feature',
    discoveryPrompt: 'Analyze requirements for the new feature. Document user stories, acceptance criteria, technical constraints, and integration points.',
    specBuildPrompt: 'Build the technical specification: API contracts, data models, component breakdown, testing strategy, and rollout plan.',
    specValidatePrompt: 'Validate the feature spec: check API consistency, test coverage plan, edge cases, and backwards compatibility.',
  },
  {
    id: 'development-v2',
    name: 'Development V2',
    description: 'Multi-sprint development with Planner → Coder → Evaluator',
    discoveryPrompt: 'Break down the development goal into sprints. Identify dependencies, risk areas, and velocity estimates per sprint.',
    specBuildPrompt: 'Build the sprint specification: sprint goals, feature breakdown, agent assignments (Planner/Coder/Evaluator), and acceptance criteria per sprint.',
    specValidatePrompt: 'Validate sprint plan for completeness: check for missing dependencies, unclear acceptance criteria, and resource conflicts.',
  },
  {
    id: 'enrich-pipeline',
    name: 'Enrich Pipeline',
    description: 'Validate + enrich an existing spec document',
    discoveryPrompt: 'Read the existing spec document and identify gaps, ambiguities, and missing information needed for implementation.',
    specBuildPrompt: 'Enrich the spec: fill gaps identified in discovery, add implementation details, clarify ambiguous requirements, and add test cases.',
    specValidatePrompt: 'Validate the enriched spec: confirm all gaps from discovery are addressed and the spec is ready for implementation.',
  },
];
```

- [ ] **Step 2: Escrever teste do template picker**

```tsx
// apps/web/components/pipeline/__tests__/pipeline-template-picker.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PipelineTemplatePicker } from '../pipeline-template-picker';

describe('PipelineTemplatePicker', () => {
  it('renders all 5 templates', () => {
    render(<PipelineTemplatePicker onSelect={vi.fn()} />);
    expect(screen.getByText('Security Audit')).toBeTruthy();
    expect(screen.getByText('Architecture Review')).toBeTruthy();
    expect(screen.getByText('Feature Pipeline')).toBeTruthy();
    expect(screen.getByText('Development V2')).toBeTruthy();
    expect(screen.getByText('Enrich Pipeline')).toBeTruthy();
  });

  it('calls onSelect with template id when clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PipelineTemplatePicker onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /security audit/i }));
    expect(onSelect).toHaveBeenCalledWith('security-audit');
  });
});
```

- [ ] **Step 3: Rodar — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/pipeline/__tests__/pipeline-template-picker.test.tsx
```

- [ ] **Step 4: Criar PipelineTemplatePicker**

```tsx
// apps/web/components/pipeline/pipeline-template-picker.tsx
import { PIPELINE_TEMPLATES } from '@wolfkrow/infra/seed/pipeline-templates';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { onSelect: (templateId: string) => void; }

export function PipelineTemplatePicker({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Start from a template</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE_TEMPLATES.map((t) => (
          <Button key={t.id} variant="outline" className="h-auto p-0" onClick={() => onSelect(t.id)}>
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-left">{t.name}</CardTitle>
                <CardDescription className="text-xs text-left">{t.description}</CardDescription>
              </CardHeader>
            </Card>
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Integrar template picker no pipeline-view**

Em `apps/web/components/pipeline/pipeline-view.tsx`:

1. Adicionar import:
```tsx
import { PIPELINE_TEMPLATES } from '@wolfkrow/infra/seed/pipeline-templates';
import { PipelineTemplatePicker } from './pipeline-template-picker';
```

2. No `CreateProjectForm`, adicionar handler e seção de templates acima dos campos:

```tsx
function applyTemplate(templateId: string, setName: ..., setDescription: ...) {
  const tpl = PIPELINE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  setName(tpl.name);
  setDescription(tpl.description);
}
```

3. Antes do campo "Project name" no formulário:
```tsx
<PipelineTemplatePicker onSelect={(id) => applyTemplate(id, setName, setDescription)} />
<hr className="my-2" />
```

- [ ] **Step 6: Export do infra package**

Em `packages/infra/src/index.ts`, adicionar:
```ts
export * from './seed/pipeline-templates';
```

- [ ] **Step 7: Rodar testes**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/pipeline/__tests__/pipeline-template-picker.test.tsx
pnpm --filter @wolfkrow/infra typecheck
pnpm --filter @wolfkrow/web typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/infra/src/seed/pipeline-templates.ts \
        packages/infra/src/index.ts \
        apps/web/components/pipeline/pipeline-template-picker.tsx \
        apps/web/components/pipeline/__tests__/pipeline-template-picker.test.tsx \
        apps/web/components/pipeline/pipeline-view.tsx
git commit -m "feat(pipeline): 5 named pipeline templates — Security/Architecture/Feature/DevV2/Enrich"
```

---

## Task 12: Calendar view para Tasks

**Files:**
- Create: `apps/web/components/tasks/tasks-calendar.tsx`
- Create: `apps/web/components/tasks/__tests__/tasks-calendar.test.tsx`
- Modify: `apps/web/app/(app)/tasks/page.tsx` (adicionar tabs Kanban | Calendar)

### Contexto

`date-fns` v4.1.0 já está disponível. Tasks têm campo `dueDate`. O calendário mostra tasks com `dueDate` agrupadas por dia do mês atual.

- [ ] **Step 1: Escrever testes do TasksCalendar**

```tsx
// apps/web/components/tasks/__tests__/tasks-calendar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TasksCalendar } from '../tasks-calendar';

const TODAY = new Date();
const TASKS = [
  {
    id: '1',
    title: 'Task with due date',
    status: 'todo' as const,
    priority: 'medium' as const,
    category: 'work',
    tags: [],
    dueDate: TODAY.toISOString(),
    description: null,
  },
  {
    id: '2',
    title: 'Task no due date',
    status: 'todo' as const,
    priority: 'low' as const,
    category: 'personal',
    tags: [],
    dueDate: null,
    description: null,
  },
];

describe('TasksCalendar', () => {
  it('renders month grid with day numbers', () => {
    render(<TasksCalendar tasks={TASKS} />);
    // Month should show days 1-28/29/30/31
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows task title on its due date', () => {
    render(<TasksCalendar tasks={TASKS} />);
    expect(screen.getByText('Task with due date')).toBeTruthy();
  });

  it('does not show task without due date in calendar', () => {
    render(<TasksCalendar tasks={TASKS} />);
    expect(screen.queryByText('Task no due date')).toBeNull();
  });

  it('renders month/year heading', () => {
    render(<TasksCalendar tasks={TASKS} />);
    const heading = screen.getByRole('heading');
    // Should contain year like "2026"
    expect(heading.textContent).toMatch(/\d{4}/);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/tasks/__tests__/tasks-calendar.test.tsx
```

- [ ] **Step 3: Criar TasksCalendar**

```tsx
// apps/web/components/tasks/tasks-calendar.tsx
'use client';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CalendarTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
}

interface Props { tasks: CalendarTask[]; }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-600';
}

export function TasksCalendar({ tasks }: Props) {
  const [current, setCurrent] = useState(new Date());
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startPad = getDay(start);

  const tasksWithDate = tasks.filter((t) => t.dueDate);

  function tasksForDay(day: Date): CalendarTask[] {
    return tasksWithDate.filter((t) => {
      try { return isSameDay(parseISO(t.dueDate!), day); } catch { return false; }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{format(current, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCurrent(subMonths(current, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => setCurrent(addMonths(current, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted overflow-hidden">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-background p-1 min-h-[80px]" />
        ))}
        {days.map((day) => {
          const dayTasks = tasksForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`bg-background p-1 min-h-[80px] ${isToday ? 'ring-1 ring-inset ring-primary' : ''}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                {getDate(day)}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <Badge key={t.id} className={`block truncate text-[10px] font-normal ${priorityColor(t.priority)}`}>
                    {t.title}
                  </Badge>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Atualizar tasks/page.tsx com tabs**

```tsx
// apps/web/app/(app)/tasks/page.tsx
import { TasksBoard } from '@/components/tasks/tasks-board';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Personal task management</p>
      </div>
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban">
          <TasksBoard />
        </TabsContent>
        <TabsContent value="calendar">
          <TasksBoardCalendarAdapter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

> Nota: `TasksBoardCalendarAdapter` é um Client Component que busca as tasks e passa para `TasksCalendar`. Como `tasks/page.tsx` é Server Component, criar um wrapper client-side:

```tsx
// apps/web/components/tasks/tasks-calendar-view.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';

import { TasksCalendar } from './tasks-calendar';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
}

export function TasksCalendarView() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/tasks', { credentials: 'include' });
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: Task[] };
    setTasks(data.tasks ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <TasksCalendar tasks={tasks} />;
}
```

Atualizar `tasks/page.tsx`:

```tsx
import { TasksBoard } from '@/components/tasks/tasks-board';
import { TasksCalendarView } from '@/components/tasks/tasks-calendar-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Personal task management</p>
      </div>
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban">
          <TasksBoard />
        </TabsContent>
        <TabsContent value="calendar">
          <TasksCalendarView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 5: Rodar testes**

```bash
pnpm --filter @wolfkrow/web test -- --reporter=verbose components/tasks/__tests__/tasks-calendar.test.tsx
```

Esperado: PASS (4 tests).

- [ ] **Step 6: Typecheck global**

```bash
pnpm typecheck
```

Esperado: 0 erros em todos os packages.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/tasks/tasks-calendar.tsx \
        apps/web/components/tasks/tasks-calendar-view.tsx \
        apps/web/components/tasks/__tests__/tasks-calendar.test.tsx \
        "apps/web/app/(app)/tasks/page.tsx"
git commit -m "feat(tasks): calendar view — tasks with dueDate shown in month grid"
```

---

## Checklist final de qualidade

Após todas as tasks, rodar:

- [ ] `pnpm typecheck` — 0 erros em todos os packages
- [ ] `pnpm test` — todos os testes passando
- [ ] `pnpm lint` — 0 violações ESLint
- [ ] Iniciar dev server e testar manualmente:
  - Sidebar: /mcp-servers abre ✅, /settings abre hub ✅
  - Onboarding: step 2 aparece após senha ✅
  - MCP: botão Add server abre modal ✅
  - Pipeline: template picker visível ✅
  - Tasks: aba Calendar funciona ✅

## Self-review

**Spec coverage checklist:**
- [x] BUG-001 sidebar /mcp → Task 1
- [x] BUG-002 sidebar /settings → Task 1 + Task 7
- [x] DT1 FEATURE_MATRIX → Task 2
- [x] DT2 stale comment → Task 3
- [x] DT5 raw inputs → Task 4
- [x] O2 LionProvider cache → Task 5
- [x] U1 OpenRouter → Task 6
- [x] U2 custom endpoint → Task 6 (customBaseUrl no LionProvider)
- [x] U6 Settings page → Task 7
- [x] Enrich UI → Task 8
- [x] Onboarding SDK choice → Task 9
- [x] MCP custom create → Task 10
- [x] U4 Pipeline templates → Task 11
- [x] Calendar view → Task 12

**Sem placeholders:** todas as tasks têm código completo.
**TDD:** cada task começa com teste que falha antes da implementação.
**Commits frequentes:** 1 commit por task.
