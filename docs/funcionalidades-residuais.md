# Funcionalidades Residuais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar todas as lacunas da auditoria Wolfkrow vs LionClaw v3.0 — paridade de providers/LLM multi-fornecedor com tela de configuração, harness multi-provider, port das features LionClaw não mapeadas (pricing, repo-profiler, security-audit, smoke-test, artifact-detector, memory-graph), higiene de código, e redesign visual ousado do frontend.

**Architecture:** Mantém Clean Architecture do monorepo (domain → use-cases → infra; web/worker como adapters). Cada feature é uma fatia vertical: entity (domain) → repo interface (domain) → drizzle schema + repo impl (infra) → use-case → worker route → API route (web) → page/component (web). Providers passam a ser data-driven via um `ProviderRegistry` único (substitui as 4 listas dessincronizadas). Redesign refatora o design-system (`packages/design-tokens`) + shell de navegação.

**Tech Stack:** TypeScript/Node 24, Next.js 15 (App Router) + React 19, Fastify (worker), better-sqlite3 + Drizzle ORM, Anthropic SDK + `@anthropic-ai/sdk` compat, shadcn/ui + Tailwind v4, Vitest, keytar (vault).

**Repos de referência:**
- Wolfkrow (target): `/Users/juniorfaria/projects/wolfkrow-tool`
- LionClaw (source de port): `/Users/juniorfaria/projects/lionclawv1.0`

**Convenções obrigatórias (validar em cada task):**
1. TDD estrito — teste falha antes da implementação.
2. `exactOptionalPropertyTypes: true` — props opcionais via spread condicional `...(x !== undefined ? { x } : {})`.
3. ESLint: `max-lines: 300`, `max-lines-per-function: 50`, `max-params: 4`, `complexity: 10`.
4. Sem import de infra em domain/use-cases/rotas.
5. Comentários só funcionais — **sem** `T\d+`, `M\d.\d`, `FIX-\d+`, `Task`, `G\d fix`, `reconciliamento`, `EMENDA`.
6. Cobertura: domain ≥95%, use-cases ≥90%, infra ≥85%, web ≥70%.
7. Timestamps via `TZ=America/Sao_Paulo`.

**Comandos de verificação globais:**
```bash
pnpm exec turbo typecheck
pnpm exec turbo lint
pnpm exec turbo test --force
```

---

## Mapa de Milestones

| Milestone | Tema | Depende de |
|-----------|------|-----------|
| RM1 | Provider Registry (fonte única de providers/LLM) | — |
| RM2 | Tela de Configuração de Providers (UI CRUD) | RM1 |
| RM3 | Tool-calling em claude-compat (multi-LLM com tools) | RM1 |
| RM4 | Harness multi-provider | RM1 |
| RM5 | Model catalog data-driven no agent form | RM1 |
| RM6 | Pricing calculator (port LionClaw) | RM1 |
| RM7 | Repo Profiler (port) | — |
| RM8 | Security Audit Runner (port) | RM7 |
| RM9 | Smoke Test Runner (port) | RM7 |
| RM10 | Artifact Detector (port) | — |
| RM11 | Memory Graph / mgraph (port) | — |
| RM12 | Higiene de código (comentários + deadcode) | — |
| RM13 | Redesign visual ousado do frontend | RM2 |

Ordem recomendada: RM1 → RM2/RM3/RM4/RM5 (paralelizáveis após RM1) → RM6 → RM7→RM8→RM9 → RM10 → RM11 → RM12 → RM13.

---

## File Structure (novos/alterados)

```
packages/domain/src/
  value-objects/provider-config.ts         [NEW] ProviderConfig VO + protocol enum
  services/provider-registry.ts            [NEW] catálogo built-in + merge custom
  repos/provider-config-repo.ts            [NEW] interface ProviderConfigRepo
  entities/repo-profile.ts                 [NEW] RM7
  entities/security-finding.ts             [NEW] RM8
  entities/artifact.ts                     [NEW] RM10
  entities/vault-note.ts                   [NEW] RM11
  services/pricing-calculator.ts           [MOD] RM6 — tabela multi-preset

packages/infra/src/
  db/schema/providers.ts                   [NEW] RM1
  db/schema/repo-profiles.ts               [NEW] RM7
  db/schema/security-audit.ts              [NEW] RM8
  repos/provider-config-repo.ts            [NEW] RM1
  ai-providers/claude-compat.ts            [MOD] RM3 — tools
  ai-providers/factory.ts                  [MOD] RM1/RM3
  services/repo-profiler.ts                [NEW] RM7
  services/security-audit-runner.ts        [NEW] RM8
  services/smoke-test-runner.ts            [NEW] RM9
  services/artifact-detector.ts            [NEW] RM10
  services/mgraph-engine.ts                [NEW] RM11

packages/use-cases/src/
  providers/                               [NEW] RM1/RM2 CRUD use-cases
  harness/run-coder-round.ts               [MOD] RM4
  audit/                                   [NEW] RM8 use-cases
  profiler/                                [NEW] RM7

apps/worker/src/
  container.ts                             [MOD] RM4 — provider param
  routes/providers.ts                      [NEW] RM2
  routes/audit.ts                          [NEW] RM8
  routes/profiler.ts                        [NEW] RM7
  chat/artifact-pipeline.ts                [NEW] RM10

apps/web/
  app/(app)/settings/providers/page.tsx    [NEW] RM2
  app/(app)/audit/page.tsx                 [NEW] RM8
  components/settings/provider-config/      [NEW] RM2
  components/chat/artifact-card.tsx        [NEW] RM10
  components/common/sidebar.tsx            [MOD] RM13
  components/agents/model-section.tsx      [MOD] RM5

packages/design-tokens/                    [MOD] RM13
```

---

# RM1 — Provider Registry (fonte única)

**Objetivo:** Um único catálogo data-driven de providers/LLM substitui as 4 listas dessincronizadas (`onboarding-form PROVIDERS`, `model-section MODELS/CLAUDE_COMPAT_PROVIDERS`, `factory switch`, `RUNTIME_TO_PROVIDER`). Suporta presets built-in + providers custom do usuário (URL, token account, modelos).

### Task RM1.1: Value Object `ProviderConfig`

**Files:**
- Create: `packages/domain/src/value-objects/provider-config.ts`
- Test: `packages/domain/src/value-objects/__tests__/provider-config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { ProviderConfig, PROVIDER_PROTOCOLS } from '../provider-config';

describe('ProviderConfig', () => {
  it('creates a valid anthropic-compat provider', () => {
    const p = ProviderConfig.create({
      id: 'zai', displayName: 'Z.ai (GLM)', protocol: 'anthropic-compat',
      baseUrl: 'https://api.z.ai/api/anthropic', apiKeyAccount: 'zai-api-key',
      models: ['glm-4.7'], supportsTools: true,
    });
    expect(p.id).toBe('zai');
    expect(p.supportsTools).toBe(true);
  });

  it('rejects empty models array', () => {
    expect(() => ProviderConfig.create({
      id: 'x', displayName: 'X', protocol: 'openai-compatible',
      baseUrl: 'https://x', apiKeyAccount: 'x', models: [], supportsTools: false,
    })).toThrow('at least one model');
  });

  it('rejects invalid protocol', () => {
    expect(PROVIDER_PROTOCOLS).toContain('anthropic-compat');
    expect(PROVIDER_PROTOCOLS).toContain('openai-compatible');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`Cannot find module '../provider-config'`)

```bash
pnpm --filter @wolfkrow/domain run test -- provider-config
```

- [ ] **Step 3: Implement**

```typescript
export const PROVIDER_PROTOCOLS = ['anthropic-compat', 'openai-compatible'] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

export interface ProviderConfigProps {
  id: string;
  displayName: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKeyAccount: string;
  models: readonly string[];
  supportsTools: boolean;
  pricingUrl?: string;
}

export class ProviderConfig {
  private constructor(private readonly props: ProviderConfigProps) {}

  static create(props: ProviderConfigProps): ProviderConfig {
    if (!props.id.trim()) throw new Error('ProviderConfig: id required');
    if (props.models.length === 0) throw new Error('ProviderConfig: at least one model required');
    if (!PROVIDER_PROTOCOLS.includes(props.protocol)) throw new Error(`ProviderConfig: invalid protocol ${props.protocol}`);
    return new ProviderConfig(props);
  }

  get id(): string { return this.props.id; }
  get displayName(): string { return this.props.displayName; }
  get protocol(): ProviderProtocol { return this.props.protocol; }
  get baseUrl(): string { return this.props.baseUrl; }
  get apiKeyAccount(): string { return this.props.apiKeyAccount; }
  get models(): readonly string[] { return this.props.models; }
  get supportsTools(): boolean { return this.props.supportsTools; }
  get pricingUrl(): string | undefined { return this.props.pricingUrl; }

  toJSON(): ProviderConfigProps { return { ...this.props }; }
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Export from domain index**

Modify `packages/domain/src/value-objects/index.ts` (ou `index.ts` raiz) adicionando:
```typescript
export { ProviderConfig, PROVIDER_PROTOCOLS } from './value-objects/provider-config';
export type { ProviderConfigProps, ProviderProtocol } from './value-objects/provider-config';
```

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/value-objects/provider-config.ts packages/domain/src/value-objects/__tests__/provider-config.test.ts packages/domain/src/index.ts
git commit -m "feat(providers): ProviderConfig value object"
```

### Task RM1.2: `ProviderRegistry` service (built-in catalog)

**Files:**
- Create: `packages/domain/src/services/provider-registry.ts`
- Test: `packages/domain/src/services/__tests__/provider-registry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { BUILT_IN_PROVIDERS, mergeProviders, getProviderById } from '../provider-registry';
import { ProviderConfig } from '../../value-objects/provider-config';

describe('ProviderRegistry', () => {
  it('ships built-in providers including claude-compat presets', () => {
    const ids = BUILT_IN_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['anthropic', 'zai', 'minimax', 'moonshot', 'qwen', 'openrouter', 'openai', 'ollama']));
  });

  it('custom provider overrides built-in by id', () => {
    const custom = ProviderConfig.create({
      id: 'zai', displayName: 'Z.ai Custom', protocol: 'anthropic-compat',
      baseUrl: 'https://custom', apiKeyAccount: 'zai-api-key', models: ['glm-5.1'], supportsTools: true,
    });
    const merged = mergeProviders(BUILT_IN_PROVIDERS, [custom]);
    expect(getProviderById(merged, 'zai')?.displayName).toBe('Z.ai Custom');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — migrar dados de `packages/domain/src/services/claude-compat-presets.ts` + `lionclaw/src/lib/provider-presets.ts` para um catálogo único. baseUrls anthropic-compat dos presets existentes; adicionar anthropic/openrouter/openai/ollama.

```typescript
import { ProviderConfig } from '../value-objects/provider-config';

export const BUILT_IN_PROVIDERS: ProviderConfig[] = [
  ProviderConfig.create({ id: 'anthropic', displayName: 'Anthropic (Claude)', protocol: 'anthropic-compat', baseUrl: 'https://api.anthropic.com', apiKeyAccount: 'anthropic', models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], supportsTools: true }),
  ProviderConfig.create({ id: 'zai', displayName: 'Z.ai (GLM)', protocol: 'anthropic-compat', baseUrl: 'https://api.z.ai/api/anthropic', apiKeyAccount: 'zai-api-key', models: ['glm-4.7', 'glm-4.5-air', 'glm-5.1', 'glm-5-turbo'], supportsTools: true }),
  ProviderConfig.create({ id: 'minimax', displayName: 'MiniMax TokenPlan', protocol: 'anthropic-compat', baseUrl: 'https://api.minimax.io/anthropic', apiKeyAccount: 'minimax-api-key', models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M3'], supportsTools: true }),
  ProviderConfig.create({ id: 'moonshot', displayName: 'Moonshot (Kimi)', protocol: 'anthropic-compat', baseUrl: 'https://api.moonshot.cn/anthropic', apiKeyAccount: 'moonshot-api-key', models: ['kimi-k2', 'kimi-k1.5'], supportsTools: true }),
  ProviderConfig.create({ id: 'qwen', displayName: 'Qwen (DashScope)', protocol: 'anthropic-compat', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/anthropic', apiKeyAccount: 'qwen-api-key', models: ['qwen-max', 'qwen-plus', 'qwen-coder-plus'], supportsTools: true }),
  ProviderConfig.create({ id: 'openrouter', displayName: 'OpenRouter', protocol: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKeyAccount: 'openrouter', models: ['openrouter/auto'], supportsTools: true }),
  ProviderConfig.create({ id: 'openai', displayName: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKeyAccount: 'openai', models: ['gpt-5.5', 'o4'], supportsTools: true }),
  ProviderConfig.create({ id: 'ollama', displayName: 'Ollama (local)', protocol: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', apiKeyAccount: 'ollama', models: ['llama-3', 'qwen3'], supportsTools: false }),
];

export function mergeProviders(builtIn: ProviderConfig[], custom: ProviderConfig[]): ProviderConfig[] {
  const map = new Map(builtIn.map((p) => [p.id, p]));
  for (const c of custom) map.set(c.id, c);
  return [...map.values()];
}

export function getProviderById(list: ProviderConfig[], id: string): ProviderConfig | undefined {
  return list.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Deprecate `claude-compat-presets.ts`** — manter re-export para não quebrar imports, mas marcar no header que a fonte canônica agora é `provider-registry.ts`. Atualizar `services/index.ts` exports.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(providers): ProviderRegistry built-in catalog"
```

### Task RM1.3: Drizzle schema + repo para providers custom

**Files:**
- Create: `packages/infra/src/db/schema/providers.ts`
- Create: `packages/infra/src/repos/provider-config-repo.ts`
- Create: `packages/domain/src/repos/provider-config-repo.ts`
- Test: `packages/infra/src/repos/__tests__/provider-config-repo.test.ts`

- [ ] **Step 1: Domain repo interface**

`packages/domain/src/repos/provider-config-repo.ts`:
```typescript
import type { ProviderConfig } from '../value-objects/provider-config';

export interface ProviderConfigRepo {
  findAll(userId: string): Promise<ProviderConfig[]>;
  upsert(userId: string, config: ProviderConfig): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}
```
Exportar em `packages/domain/src/repos/index.ts`.

- [ ] **Step 2: Drizzle schema** (espelhar padrão de `packages/infra/src/db/schema/mcp-servers.ts`)

```typescript
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  providerId: text('provider_id').notNull(),
  displayName: text('display_name').notNull(),
  protocol: text('protocol').notNull(),
  baseUrl: text('base_url').notNull(),
  apiKeyAccount: text('api_key_account').notNull(),
  models: text('models', { mode: 'json' }).notNull().$type<string[]>(),
  supportsTools: integer('supports_tools', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  byUser: index('provider_configs_user_idx').on(t.userId),
}));
```
Registrar em `packages/infra/src/db/schema/index.ts`.

- [ ] **Step 3: Migration** — gerar via drizzle-kit:

```bash
pnpm --filter @wolfkrow/infra run db:generate
```
Verificar arquivo SQL gerado em `packages/infra/drizzle/`.

- [ ] **Step 4: Write failing repo test** (mock `Db` seguindo `scheduler-repo.test.ts`)

```typescript
import { describe, expect, it, vi } from 'vitest';
import { ProviderConfig } from '@wolfkrow/domain';
import { DrizzleProviderConfigRepo } from '../provider-config-repo';

describe('DrizzleProviderConfigRepo', () => {
  it('upsert then findAll returns the provider', async () => {
    // build in-memory better-sqlite3 + migrate (seguir padrão de repos/__tests__ existentes)
    const repo = makeRepoForTest();
    const cfg = ProviderConfig.create({ id: 'custom1', displayName: 'Custom', protocol: 'openai-compatible', baseUrl: 'https://x/v1', apiKeyAccount: 'custom1', models: ['m1'], supportsTools: false });
    await repo.upsert('user-1', cfg);
    const all = await repo.findAll('user-1');
    expect(all.map((p) => p.id)).toContain('custom1');
  });
});
```

- [ ] **Step 5: Implement `DrizzleProviderConfigRepo`** mapeando row↔`ProviderConfig.create`. `upsert` via `insert ... onConflictDoUpdate` por `(userId, providerId)`.

- [ ] **Step 6: Run test — expect PASS; registrar repo no `getRepos()` container.**

- [ ] **Step 7: Commit**

```bash
git commit -am "feat(providers): drizzle provider_configs schema + repo"
```

### Task RM1.4: Refatorar `factory.ts` para usar registry + protocol

**Files:**
- Modify: `packages/infra/src/ai-providers/factory.ts`
- Test: `packages/infra/src/ai-providers/__tests__/factory.test.ts`

- [ ] **Step 1: Write failing test** — factory cria provider via `ProviderConfig` (protocol decide a classe):

```typescript
it('creates anthropic-compat provider from ProviderConfig', () => {
  const cfg = ProviderConfig.create({ id: 'zai', displayName: 'Z', protocol: 'anthropic-compat', baseUrl: 'https://api.z.ai/api/anthropic', apiKeyAccount: 'zai-api-key', models: ['glm-4.7'], supportsTools: true });
  const f = new ProviderAIProviderFactory();
  const provider = f.createFromConfig(cfg, 'key', toolRegistry);
  expect(provider).toBeInstanceOf(ClaudeCompatProvider);
});
```

- [ ] **Step 2: Run — expect FAIL** (`createFromConfig` não existe)

- [ ] **Step 3: Implement `createFromConfig(cfg, apiKey, toolRegistry?, permissionResolver?)`** — switch por `cfg.protocol`: `anthropic-compat` → `ClaudeCompatProvider(apiKey, cfg.baseUrl, cfg.supportsTools, toolRegistry, permissionResolver)`; `openai-compatible` → `CodexProvider(apiKey, cfg.baseUrl)`. Manter o `create(provider, apiKey)` legado delegando ao registry para não quebrar callers.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(providers): factory.createFromConfig driven by ProviderConfig protocol"
```

---

# RM2 — Tela de Configuração de Providers

**Objetivo:** Página em Settings onde o usuário gerencia providers/LLM: criar/editar/remover provider custom (displayName, protocol, baseUrl/URL, account do token, lista de modelos, supportsTools), e salvar a API key no vault. Built-in aparecem read-only com opção de "override".

### Task RM2.1: Use-cases CRUD de provider

**Files:**
- Create: `packages/use-cases/src/providers/list-providers.ts`
- Create: `packages/use-cases/src/providers/save-provider.ts`
- Create: `packages/use-cases/src/providers/delete-provider.ts`
- Create: `packages/use-cases/src/providers/index.ts`
- Test: `packages/use-cases/src/providers/__tests__/providers.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { ListProvidersUseCase } from '../list-providers';
import { SaveProviderUseCase } from '../save-provider';

describe('providers use-cases', () => {
  it('list merges built-in + custom', async () => {
    const repo = makeFakeRepo([]);
    const uc = new ListProvidersUseCase(repo);
    const out = await uc.execute({ userId: 'u1' });
    expect(out.providers.map((p) => p.id)).toContain('zai');
  });

  it('save persists a custom provider', async () => {
    const repo = makeFakeRepo([]);
    const uc = new SaveProviderUseCase(repo);
    await uc.execute({ userId: 'u1', config: { id: 'c1', displayName: 'C1', protocol: 'openai-compatible', baseUrl: 'https://c/v1', apiKeyAccount: 'c1', models: ['m1'], supportsTools: false } });
    const all = await repo.findAll('u1');
    expect(all.map((p) => p.id)).toContain('c1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — `ListProvidersUseCase` usa `mergeProviders(BUILT_IN_PROVIDERS, await repo.findAll(userId))`. `SaveProviderUseCase` valida via `ProviderConfig.create` então `repo.upsert`. `DeleteProviderUseCase` chama `repo.delete` (rejeita delete de built-in que não tem override).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(providers): list/save/delete provider use-cases"
```

### Task RM2.2: Worker route `/providers`

**Files:**
- Create: `apps/worker/src/routes/providers.ts`
- Modify: `apps/worker/src/server.ts` (registrar rota)
- Test: `apps/worker/src/routes/__tests__/providers-route.test.ts`

- [ ] **Step 1: Write failing test** — `GET /providers` retorna lista; `POST /providers` cria; `DELETE /providers/:id` remove. Seguir padrão de `apps/worker/src/routes/__tests__/harness-run.test.ts` (build Fastify app de teste).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** rota com `preHandler: [server.authenticate]`, usando os use-cases via `getRepos().providerConfig`. POST também salva `apiKey` no vault via `secretsAdapter.set(cfg.apiKeyAccount, apiKey)` quando enviado no body.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(providers): worker /providers CRUD route"
```

### Task RM2.3: API route + página web de providers

**Files:**
- Create: `apps/web/app/api/providers/route.ts` (proxy → worker)
- Create: `apps/web/app/(app)/settings/providers/page.tsx`
- Create: `apps/web/components/settings/provider-config/provider-list.tsx`
- Create: `apps/web/components/settings/provider-config/provider-form-modal.tsx`
- Create: `apps/web/components/settings/provider-config/schema.ts`
- Test: `apps/web/components/settings/provider-config/__tests__/provider-form-modal.test.tsx`

- [ ] **Step 1: Write failing component test** (RTL) — `ProviderFormModal` renderiza campos: Display name, Protocol (select anthropic-compat/openai-compatible), Base URL, API key account, Models (lista editável chips), Supports tools (switch), API key (password). Submit chama `onSave` com payload válido.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProviderFormModal } from '../provider-form-modal';

it('submits a valid custom provider', async () => {
  const onSave = vi.fn();
  render(<ProviderFormModal open onSave={onSave} onClose={() => {}} />);
  await userEvent.type(screen.getByLabelText(/display name/i), 'My LLM');
  await userEvent.type(screen.getByLabelText(/base url/i), 'https://my/v1');
  await userEvent.type(screen.getByLabelText(/api key account/i), 'my-llm');
  await userEvent.type(screen.getByLabelText(/^models$/i), 'model-a');
  await userEvent.click(screen.getByRole('button', { name: /add model/i }));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'My LLM', baseUrl: 'https://my/v1', models: ['model-a'] }));
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @wolfkrow/web run test -- provider-form-modal
```

- [ ] **Step 3: Implement** — `schema.ts` com zod (`react-hook-form` + `zodResolver`); modal com campos acima; `provider-list.tsx` lista cards (built-in com badge "built-in" read-only + botão Override; custom com Edit/Delete); page busca `/api/providers` e renderiza lista + botão "Add provider". Manter cada arquivo ≤300 linhas (extrair sub-componentes se necessário).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Adicionar link "Providers & LLMs" no SettingsView** (`settings-view.tsx` SECTIONS) com ícone `Cpu` e href `/settings/providers`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(providers): provider config screen (list + form modal)"
```

### Task RM2.4: Onboarding usa registry

**Files:**
- Modify: `apps/web/components/auth/onboarding-form.tsx:32` (`PROVIDERS`)

- [ ] **Step 1: Write failing test** — onboarding lista todos os providers built-in (incl. zai/minimax/moonshot/qwen).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — buscar `/api/providers` (ou importar `BUILT_IN_PROVIDERS` via shared) e popular o `<select>` dinamicamente; placeholder por protocolo.

- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(providers): onboarding provider list from registry"
```

---

# RM3 — Tool-calling em claude-compat (multi-LLM com tools)

**Objetivo:** Providers anthropic-compat (zai/minimax/moonshot/qwen) suportam tool_use nativo. Remover o "tools ignorados". Quando `supportsTools`, claude-compat usa o caminho agêntico (registry + permission resolver), igual ao `ClaudeAgentProvider`.

### Task RM3.1: `ClaudeCompatProvider` aceita tools

**Files:**
- Modify: `packages/infra/src/ai-providers/claude-compat.ts`
- Test: `packages/infra/src/ai-providers/__tests__/claude-compat.test.ts`

- [ ] **Step 1: Write failing test** — provider com toolRegistry emite `tool_call` chunk quando o stream Anthropic retorna `tool_use`.

```typescript
it('emits tool_call chunk on tool_use block', async () => {
  const registry = makeRegistryWithEchoTool();
  const provider = new ClaudeCompatProvider('key', 'https://api.z.ai/api/anthropic', true, registry);
  const stream = provider.query({ model: 'glm-4.7', messages: [{ role: 'user', content: 'use echo' }] });
  const chunks = await collect(stream);
  expect(chunks.some((c) => c.toolCall?.name === 'echo')).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — alterar construtor para `(apiKey, baseUrl, supportsTools, toolRegistry?, permissionResolver?)`. Quando `supportsTools && toolRegistry`, montar `tools` no request (`messages.stream({ tools })`) e processar blocos `tool_use`/`tool_result` no `drainStream` (espelhar a lógica de `claude-agent.ts`). Quando não, manter comportamento texto-only atual. Atualizar o construtor em `factory.createFromConfig`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(providers): tool-calling support in ClaudeCompatProvider"
```

### Task RM3.2: Chat route respeita provider do agente para tools

**Files:**
- Modify: `apps/worker/src/routes/chat.ts:146-157`
- Test: `apps/worker/src/routes/__tests__/chat-route.test.ts`

- [ ] **Step 1: Write failing test** — agente `runtime=claude-compat, provider=zai, allowedTools=[bash]` NÃO é forçado para Anthropic; usa ClaudeCompatProvider com tools.

- [ ] **Step 2: Run — expect FAIL** (hoje força `getAnthropicApiKey` + claude-agent)

- [ ] **Step 3: Implement** — substituir o bloco que sempre cria agentic Anthropic por: resolver `ProviderConfig` do agente via registry; se `supportsTools`, criar provider agêntico via `factory.createFromConfig(cfg, apiKey, registryComAllowedTools, requestPermission)`. Anthropic continua sendo o caso quando `provider=anthropic`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "fix(chat): honor agent provider for tool-enabled claude-compat agents"
```

---

# RM4 — Harness multi-provider

**Objetivo:** Planner/coder/evaluator do harness deixam de ser Anthropic-fixos; usam o provider definido no `HarnessProject.config`.

### Task RM4.1: Adicionar provider ao config do harness

**Files:**
- Modify: `packages/domain/src/entities/harness-project.ts` (config: adicionar `providerId?: string`)
- Test: `packages/domain/src/entities/__tests__/harness-project.test.ts`

- [ ] **Step 1: Write failing test** — `HarnessProject.create` aceita e expõe `config.providerId`.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — adicionar campo opcional `providerId` ao `HarnessConfig` (default resolve para `anthropic` no container, não no domínio).
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(harness): providerId in HarnessProject config"
```

### Task RM4.2: `make*` agents parametrizados por provider

**Files:**
- Modify: `apps/worker/src/container.ts:133-239` (`makePlanner`, `makeCoder`, `makeEvaluator`, `makeCoderWithTools`)
- Test: `apps/worker/src/harness/__tests__/runner.test.ts`

- [ ] **Step 1: Write failing test** — `makeCoder('zai')` resolve provider zai (mock factory verifica `createFromConfig` chamado com cfg.id==='zai').

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — assinatura `makePlanner(providerId = 'anthropic')` etc. Resolver: `const cfg = getProviderById(allProviders, providerId); const apiKey = await getProviderApiKey(cfg.apiKeyAccount); const provider = factory.createFromConfig(cfg, apiKey);`. `getHarnessAgents(providerId)` propaga. Rotas passam `project.config.providerId ?? 'anthropic'`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: UI** — adicionar select de provider no formulário de criação de projeto harness (`apps/web/components/harness/*`), populado via `/api/providers`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(harness): multi-provider planner/coder/evaluator"
```

---

# RM5 — Model catalog data-driven no agent form

**Objetivo:** Dropdown de modelo no agent form reflete os modelos do provider selecionado (corrige bug: claude-compat só oferecia 3 modelos Claude).

### Task RM5.1: `model-section` usa modelos do provider

**Files:**
- Modify: `apps/web/components/agents/model-section.tsx`
- Test: `apps/web/components/agents/__tests__/model-section.test.tsx`

- [ ] **Step 1: Write failing test** — ao escolher `runtime=claude-compat` + `provider=zai`, o select de Model lista `glm-4.7` etc (não claude).

```tsx
it('lists provider models when claude-compat+zai selected', async () => {
  render(<ModelSection control={control} providers={MOCK_PROVIDERS} />);
  // set runtime=claude-compat, provider=zai
  expect(await screen.findByRole('option', { name: 'glm-4.7' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL** (hoje `MODELS` é const fixa)

- [ ] **Step 3: Implement** — receber `providers: ProviderConfigProps[]` via prop (page busca `/api/providers`). `MODELS` derivado: `useWatch(provider)` → `getProviderById(providers, provider)?.models ?? defaultClaudeModels`. Quando `runtime !== 'claude-compat'`, usar modelos do provider mapeado pelo runtime.

- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "fix(agents): model dropdown driven by selected provider catalog"
```

---

# RM6 — Pricing Calculator (port LionClaw)

**Objetivo:** Portar `lionclaw/electron/main/pricing.ts` (18KB) → `pricing-calculator` no domínio com tabela multi-preset, e expor cálculo de custo na Usage page (FEATURE_MATRIX #40).

### Task RM6.1: Tabela de pricing multi-preset

**Files:**
- Modify: `packages/domain/src/services/pricing-calculator.ts`
- Test: `packages/domain/src/services/__tests__/pricing-calculator.test.ts`

- [ ] **Step 1: Write failing test** — custo de `kimi-k2` via preset moonshot difere de claude; `cost('glm-4.7', {input:1000,output:500})` retorna valor>0 quando preço conhecido, e `{status:'unknown'}` quando não.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — portar `MODEL_PRICING`, `PRESET_MODEL_PRICING` (kimi etc), `calculateCost`, `hasKnownPricing`, `formatCost`, `formatTokens` de `lionclaw/electron/main/pricing.ts:5-329`. Adaptar para domínio puro (sem deps infra). Manter API existente `defaultPricingCalculator.cost(model, usage)` retrocompatível; adicionar `presetId` opcional.

- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(pricing): multi-preset pricing table ported from lionclaw"
```

### Task RM6.2: Usage page mostra custo estimado por modelo/provider

**Files:**
- Modify: `apps/web/components/usage/*` (componente de tabela/charts)
- Test: respectivo `__tests__`

- [ ] **Step 1: Write failing test** — tabela de usage exibe coluna "Cost (USD)" calculada e badge "unknown" quando pricing ausente.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — consumir `pricingCalculate`; agregação por modelo. Render coluna custo.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(usage): per-model estimated cost via pricing calculator"
```

---

# RM7 — Repo Profiler (port)

**Objetivo:** Portar `lionclaw/electron/main/repo-profiler.ts` (31KB) → serviço que gera manifesto do repo (stack, roles, frameworks) e alimenta o harness planner.

### Task RM7.1: Entity `RepoProfile` + tipos

**Files:**
- Create: `packages/domain/src/entities/repo-profile.ts`
- Test: `packages/domain/src/entities/__tests__/repo-profile.test.ts`

- [ ] **Step 1: Write failing test** — `RepoProfile.create({ root, languages, frameworks, roles, fileCount })` valida e expõe campos.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `RepoManifest`, `Role`, `ROLE_METADATA`, `PATH_HINTS` de `repo-profiler.ts:33-288` como tipos do domínio; `RepoProfile` entity encapsula o manifesto.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(profiler): RepoProfile entity + role taxonomy"
```

### Task RM7.2: `RepoProfilerService` (infra)

**Files:**
- Create: `packages/infra/src/services/repo-profiler.ts`
- Test: `packages/infra/src/services/__tests__/repo-profiler.test.ts`

- [ ] **Step 1: Write failing test** — `profile(dir)` sobre um fixture com `package.json` + `*.ts` detecta language `typescript` e role `api` para arquivos em `routes/`.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `runRepoProfiler`, `classifyByContent`, `stripCommentsAndStrings`, `EXCLUDED_FROM_AUDIT_PATTERNS` de `repo-profiler.ts:200-845`. Usar `node:fs` direto (infra). Respeitar limites de `chunking.rules.md` (skip >1MB, excluir node_modules/.git). Sem `detectStackWithAgent` por ora (heurística por path/conteúdo) — agente opcional em task futura.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(profiler): RepoProfilerService heuristic stack/role detection"
```

### Task RM7.3: Planner consome profile

**Files:**
- Modify: `apps/worker/src/container.ts` (`makePlanner`)
- Modify: `apps/worker/src/routes/profiler.ts` [NEW]
- Test: route test

- [ ] **Step 1: Write failing test** — `POST /profiler` com `{ dir }` retorna manifesto; planner recebe resumo do profile no prompt.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — rota chama `RepoProfilerService.profile`; `makePlanner` aceita `repoSummary?` e injeta no system/user prompt.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(profiler): /profiler route + planner repo-context injection"
```

---

# RM8 — Security Audit Runner (port)

**Objetivo:** Portar `lionclaw/electron/main/security-audit-runner.ts` (37KB) → fatia vertical de auditoria de segurança do repo com agentes especializados, persistência de findings e página `/audit`.

### Task RM8.1: Entity `SecurityFinding` + schema

**Files:**
- Create: `packages/domain/src/entities/security-finding.ts`
- Create: `packages/infra/src/db/schema/security-audit.ts`
- Test: entity test

- [ ] **Step 1: Write failing test** — `SecurityFinding.create({ scanId, severity, file, line, message, dimension })` valida severity ∈ {info,warning,major,critical,blocker}.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** entity + schema `security_findings` + `security_scans` (id, startedAt, status, summary). Migration via drizzle-kit.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(audit): SecurityFinding entity + security_audit schema"
```

### Task RM8.2: `SecurityAuditRunner` service

**Files:**
- Create: `packages/infra/src/services/security-audit-runner.ts`
- Test: `packages/infra/src/services/__tests__/security-audit-runner.test.ts`

- [ ] **Step 1: Write failing test** — `run({ dir, agents })` com mock AI provider retorna findings parseados de uma resposta JSON; respeita concorrência limite.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `SECURITY_AUDIT_AGENTS`, `resolveFilesForAgent`, `runWithConcurrencyLimit`, `buildAuditPrompt`, parsing de `security-findings-parser.ts` (`security-audit-runner.ts:56-896`). Provider injetado (não Anthropic-fixo) — usar `factory.createFromConfig`. Reusar `RepoProfilerService` (RM7) para seleção de arquivos.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(audit): SecurityAuditRunner ported (agents + concurrency + parser)"
```

### Task RM8.3: Use-cases + route + página `/audit`

**Files:**
- Create: `packages/use-cases/src/audit/run-audit.ts`, `list-findings.ts`, `index.ts`
- Create: `apps/worker/src/routes/audit.ts`
- Create: `apps/web/app/(app)/audit/page.tsx` + `apps/web/components/audit/*`
- Create: sidebar link

- [ ] **Step 1: Write failing tests** — use-case `RunAuditUseCase.execute({dir,userId})` persiste scan+findings; route `POST /audit/run`, `GET /audit/:scanId/findings`; page renderiza tabela de findings por severidade.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** fatia completa. Página: form de path + botão "Run audit" (SSE de progresso opcional), tabela de findings com filtro por severidade + export CSV (reusar util de M6.4 audit-log export).
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Sidebar** — adicionar `{ title: 'Security Audit', url: '/audit', icon: ShieldAlert }` no `AUTOMATION_NAV` ou novo grupo.
- [ ] **Step 6: Commit**

```bash
git commit -am "feat(audit): run-audit use-case + /audit route + page"
```

---

# RM9 — Smoke Test Runner (port)

**Objetivo:** Portar `lionclaw/electron/main/smoke-test-runner.ts` (12KB) → serviço que roda typecheck/lint/test + checa imports quebrados; integra ao loop do harness (gate pós-coder).

### Task RM9.1: `SmokeTestRunner` service

**Files:**
- Create: `packages/infra/src/services/smoke-test-runner.ts`
- Test: `packages/infra/src/services/__tests__/smoke-test-runner.test.ts`

- [ ] **Step 1: Write failing test** — `run(projectDir)` sobre fixture com script `typecheck` retorna `{ typecheck: {passed:true} }`; detecta import quebrado.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `SmokeTestResult`, `spawnCommand`, `runTypecheck/runLint/runTests`, `checkBrokenImports`, `checkMissingFiles` de `smoke-test-runner.ts:8-346`. `spawnCommand` via `node:child_process` (infra).
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(smoke): SmokeTestRunner ported (typecheck/lint/test/imports)"
```

### Task RM9.2: Harness evaluator usa smoke como gate

**Files:**
- Modify: `apps/worker/src/container.ts` (`makeCoderWithTools` / `makeEvaluator`) + `apps/worker/src/harness/runner.ts`
- Test: runner test

- [ ] **Step 1: Write failing test** — após coder round em workDir, runner executa smoke; round falha (`passed=false`) se typecheck falhar, com feedback.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — no runner, após `implement`, rodar `SmokeTestRunner.run(workDir)`; anexar resultado ao feedback do evaluator.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(harness): smoke test gate in coder/evaluator loop"
```

---

# RM10 — Artifact Detector (port)

**Objetivo:** Portar `lionclaw/electron/main/artifact-detector.ts` (12KB) → detectar artefatos (imagens, excalidraw) em tool results e renderizar inline no chat (FEATURE_MATRIX #36).

### Task RM10.1: `ArtifactDetector` service + entity

**Files:**
- Create: `packages/domain/src/entities/artifact.ts`
- Create: `packages/infra/src/services/artifact-detector.ts`
- Test: `packages/infra/src/services/__tests__/artifact-detector.test.ts`

- [ ] **Step 1: Write failing test** — `detect(toolName, input, output)` retorna `{type:'excalidraw'}` p/ tool excalidraw e `{type:'image', path}` quando output contém caminho de imagem existente.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `isExcalidrawTool`, `buildExcalidrawFile`, `extractElements`, `isSupportedImagePath`, `firstExistingImagePath`, `buildImageArtifact` de `artifact-detector.ts:12-167`. `Artifact` entity no domínio (type, payload, toolUseId, title?).
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(artifacts): ArtifactDetector ported (image + excalidraw)"
```

### Task RM10.2: Pipeline de chat emite artifact + UI render

**Files:**
- Create: `apps/worker/src/chat/artifact-pipeline.ts`
- Modify: `apps/web/components/chat/sse.ts` (novo evento `artifact`)
- Create: `apps/web/components/chat/artifact-card.tsx`
- Test: ambos

- [ ] **Step 1: Write failing tests** — worker emite SSE `{type:'artifact', artifact}` após tool_result; `ArtifactCard` renderiza imagem ou embed excalidraw.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — no handler de tool_result do chat, chamar `ArtifactDetector.detect` e emitir evento; `sse.ts` adiciona variant ao union `SSEEvent`; `ArtifactCard` renderiza por tipo. Integrar no `chat-view` message render.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(chat): artifact detection pipeline + inline render"
```

---

# RM11 — Memory Graph / mgraph (port)

**Objetivo:** Portar `lionclaw/electron/main/mgraph-engine.ts` (36KB) → vault de notas markdown com frontmatter, índice, busca e grafo; integrar à Graph page e Memory.

### Task RM11.1: `VaultNote` entity + `MgraphEngine` service

**Files:**
- Create: `packages/domain/src/entities/vault-note.ts`
- Create: `packages/infra/src/services/mgraph-engine.ts`
- Test: `packages/infra/src/services/__tests__/mgraph-engine.test.ts`

- [ ] **Step 1: Write failing test** — `executeVaultOperation({op:'create', path, content})` cria nota; `buildGraphData()` retorna nós/arestas a partir de wikilinks `[[...]]`; `searchVault(q)` acha por título/conteúdo.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — portar `getVaultRoot`, `sanitizeFilename`, `validateVaultPath`, `createVaultStructure`, `executeVaultOperation`, `regenerateVaultIndex`, `buildGraphData`, `searchVault`, `getVaultStats`, `readVaultNote`, `listNotesByType` de `mgraph-engine.ts:16-560`. Vault root configurável (`.wolfkrow/vault/`). Sandbox de path obrigatório (`validateVaultPath` bloqueia traversal).
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(mgraph): vault notes engine ported (ops + graph + search)"
```

### Task RM11.2: Route + integração Graph page

**Files:**
- Create/Modify: `apps/worker/src/routes/graph.ts` (ops de vault)
- Modify: `apps/web/app/(app)/graph/*` + `apps/web/app/(app)/memory/*`
- Test: route + component

- [ ] **Step 1: Write failing test** — `GET /graph/data` retorna grafo do vault; Graph page renderiza nós (d3/força) + busca.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — rota expõe `buildGraphData`/`searchVault`/`getVaultStats`; Graph page consome; Memory page lista notas por tipo + cria nota.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(mgraph): /graph vault data route + Graph/Memory integration"
```

---

# RM12 — Higiene de código

**Objetivo:** Remover os 63 comentários com refs de task/fix e o deadcode identificado.

### Task RM12.1: Remover refs de task/fix em comentários

**Files:**
- Modify: arquivos listados pelo grep abaixo.

- [ ] **Step 1: Inventariar**

```bash
grep -rn "FIX-[0-9]\|Task [0-9]\|\bT[0-9][0-9]\b\|M[0-9]\.[0-9]\|reconciliamento\|G[0-9] fix\|EMENDA" packages/*/src apps/*/src apps/web/components apps/web/app 2>/dev/null | grep -v "__tests__\|\.test\."
```

- [ ] **Step 2: Editar** cada ocorrência — manter a descrição funcional, remover o prefixo de rastreamento. Ex: `/** T17: emitted when a destructive tool requires user approval. */` → `/** Emitted when a destructive tool requires user approval. */`.

- [ ] **Step 3: Verificar zero ocorrências**

```bash
grep -rn "FIX-[0-9]\|Task [0-9]\|\bT[0-9][0-9]\b\|M[0-9]\.[0-9]\|reconciliamento\|G[0-9] fix\|EMENDA" packages/*/src apps/*/src apps/web/components apps/web/app 2>/dev/null | grep -v "__tests__\|\.test\." | wc -l
# Expected: 0
```

- [ ] **Step 4: Typecheck + lint + test**

```bash
pnpm exec turbo typecheck lint test --force
```

- [ ] **Step 5: Commit**

```bash
git commit -am "chore: strip task/fix references from code comments"
```

### Task RM12.2: Remover deadcode

**Files:**
- Modify: `packages/infra/src/ai-providers/lion.ts`
- Delete/Modify: `packages/infra/src/tools/skill-tool.ts`, `memory-tool.ts`

- [ ] **Step 1:** Decidir destino dos stubs `skill-tool`/`memory-tool`:
  - SE forem implementados como tools reais → fazê-lo (registrar no ToolRegistry do chat agêntico, conectar aos use-cases de skills/memory).
  - SENÃO → remover os arquivos e o export em `tools/index.ts`.
  Recomendado: **implementar** (alinha com RM3 tools) — criar test que o `skill` tool retorna conteúdo real de uma skill por nome via `getRepos().skill`.

- [ ] **Step 2:** `lion.ts` — remover branches inalcançáveis (`stub:` em `adapterKey`, `zai-`/`groq-`/`gemini-` throws) OU manter `LionProvider` apenas se for usado; se `case 'lion'` nunca é atingido por caller real, considerar remover do factory. Verificar:

```bash
grep -rn "'lion'\|\"lion\"\|provider.*lion\|runtime.*lion" packages apps --include="*.ts" --include="*.tsx" | grep -v "lion.ts\|\.test\.\|dist/"
```

- [ ] **Step 3:** `workflow/` resíduo — confirmar ADR-0027 descope; adicionar nota no `workflow/index.ts` ou remover schema/entity/repo se sem consumidor planejado.

- [ ] **Step 4: Test + commit**

```bash
git commit -am "chore: remove deadcode (lion.ts unreachable branches, wire/remove stub tools)"
```

---

# RM13 — Redesign Visual Ousado do Frontend

**Objetivo:** Nova identidade visual, shell de navegação repensado, densidade e usabilidade melhoradas. Mantém shadcn/ui como base de componentes mas com tokens, tipografia, cor e layout repensados.

> **Nota de escopo:** redesign é amplo. Cada task abaixo é uma fatia testável e commitável. Visual não tem assert de pixel — testes garantem que componentes renderizam e navegação funciona; revisão visual é manual via Storybook.

### Task RM13.1: Nova paleta + tokens de design

**Files:**
- Modify: `packages/design-tokens/` (tokens de cor, espaçamento, raio, sombra, tipografia)
- Modify: `apps/web/app/globals.css` (CSS vars)
- Test: `packages/design-tokens/__tests__/tokens.test.ts`

- [ ] **Step 1: Write failing test** — tokens expõem nova escala (`--color-brand-500`, `--radius-lg`, `--font-display`); contraste AA garantido (helper que valida ratio ≥4.5 para text/bg).
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — definir paleta (dark-first, brand distinta do amber/orange atual genérico), escala tipográfica (display/body/mono), espaçamento 4px-base, radii, sombras em camadas. Exportar como CSS vars + objeto TS. Garantir dark/light.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(design): new design tokens — palette, type scale, spacing"
```

### Task RM13.2: App shell + sidebar redesenhados

**Files:**
- Modify: `apps/web/components/common/sidebar.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/components/common/command-palette.tsx` (Cmd+K)
- Create: `apps/web/components/common/topbar.tsx`
- Test: `apps/web/components/common/__tests__/sidebar.test.tsx`, `command-palette.test.tsx`

- [ ] **Step 1: Write failing tests** — sidebar agrupa nav com ícones+labels, marca ativo, colapsável; `CommandPalette` abre com Cmd+K e navega ao selecionar; `Topbar` mostra breadcrumb + ações contextuais.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — sidebar com grupos refinados (Main/Build/Knowledge/System), estados hover/active com novos tokens, footer com user + lock. Topbar com breadcrumb dinâmico (`usePathname`) e slot de ações. Command palette (cmdk) indexando todas as rotas + ações ("New agent", "Run audit", etc).
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(design): redesigned app shell — sidebar, topbar, command palette"
```

### Task RM13.3: Settings vira hub real + tabs

**Files:**
- Modify: `apps/web/components/settings/settings-view.tsx`
- Create: `apps/web/components/settings/settings-shell.tsx` (layout com tabs laterais)
- Test: settings-view test

- [ ] **Step 1: Write failing test** — Settings renderiza tabs (Providers, Vault, Agents, MCP, Automation, Rules, Permissions, Channels, Usage) e o conteúdo da tab Providers (RM2) inline, não só links.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — `settings-shell` com nav vertical de tabs; Providers tab embute o componente de RM2; demais tabs linkam ou embutem conforme disponível.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(design): settings shell with inline provider config tab"
```

### Task RM13.4: Chat redesenhado (densidade + UX)

**Files:**
- Modify: `apps/web/components/chat/chat-view.tsx` + sub-componentes
- Create: `apps/web/components/chat/message-bubble.tsx`, `composer.tsx`
- Test: respectivos

- [ ] **Step 1: Write failing tests** — `MessageBubble` distingue user/assistant/tool com layout novo; `Composer` tem attach, model picker inline (via `/api/providers`), stop button; tool calls colapsáveis.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — extrair render de mensagem para `MessageBubble` (markdown, code highlight, artifact-card de RM10), `Composer` com toolbar. Manter `chat-view` ≤300 linhas.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(design): redesigned chat — message bubbles, composer, inline model picker"
```

### Task RM13.5: Páginas-chave alinhadas ao novo design

**Files:**
- Modify: `agents`, `mcp-servers`, `knowledge`, `tasks`, `usage`, `harness`, `pipeline` pages/components — aplicar tokens, cards, tabelas e empty-states consistentes.
- Test: smoke render por página.

- [ ] **Step 1: Write failing tests** — cada página renderiza header padronizado (`PageHeader` component) + empty-state quando sem dados.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** — criar `components/common/page-header.tsx` e `empty-state.tsx`; aplicar em cada página. Padronizar tabelas (`DataTable`) e cards.
- [ ] **Step 4: Run — expect PASS; Commit**

```bash
git commit -am "feat(design): standardized page header + empty states across key pages"
```

### Task RM13.6: Storybook + revisão visual

**Files:**
- Modify: stories dos novos componentes
- Test: `pnpm --filter @wolfkrow/web run storybook` (build)

- [ ] **Step 1:** Adicionar stories para tokens, sidebar, topbar, command palette, message bubble, provider form, page header, empty state.
- [ ] **Step 2:** Build storybook estático e revisar manualmente dark/light + responsivo (≥1280, 768, 380).
- [ ] **Step 3: Commit**

```bash
git commit -am "docs(design): storybook stories for redesigned components"
```

---

## Release / Validação Final

- [ ] `pnpm exec turbo typecheck lint test --force` verde.
- [ ] Coverage gates atingidos (domain ≥95%, use-cases ≥90%, infra ≥85%, web ≥70%).
- [ ] Zero refs de task/fix em comentários (RM12.1 Step 3).
- [ ] Atualizar `docs/FEATURE_MATRIX.md`: #16 harness multi-provider ✅, #36 artifacts ✅, #40 pricing ✅, security-audit/repo-profiler/smoke ✅, provider config UI ✅.
- [ ] ADR novo: `docs/adr/0033-provider-registry.md` (fonte única + protocol anthropic-compat vs openai-compatible).
- [ ] ADR novo: `docs/adr/0034-frontend-redesign.md` (decisões de design system).
- [ ] Atualizar `docs/RELEASE_CHECKLIST.md` com smoke manual das novas telas.
- [ ] Manual: criar provider custom via UI, configurar key, criar agente claude-compat com tools, rodar chat com tool call, rodar harness com provider não-anthropic, rodar audit, ver artifact inline.

---

## Self-Review (cobertura vs auditoria)

| Item da auditoria | Coberto por |
|---|---|
| §1 features não mapeadas (security-audit, repo-profiler, smoke, pricing, artifact, mgraph) | RM6, RM7, RM8, RM9, RM10, RM11 |
| §2 skill/memory tools stub | RM12.2 (implementar ou remover) |
| §3 model dropdown hardcoded | RM5 |
| §3 comentários task/fix | RM12.1 |
| §4 chat força anthropic em claude-compat+tools | RM3.2 |
| §4 claude-compat sem tools | RM3.1 |
| §4 harness anthropic-fixo | RM4 |
| §4 lion.ts deadcode | RM12.2 |
| §7 sem UI config provider | RM2 |
| §8 compat z.ai/moonshot/minimax/qwen | RM1, RM2, RM3 |
| §9 harness/pipeline paridade | RM4, RM7, RM9 |
| §11 deadcode | RM12.2 |
| §13 workflows resíduo | RM12.2 Step 3 |
| §14 layout/UX | RM13 |
| Provider config screen (URL/token/LLMs) | RM2.3 |
| Redesign ousado | RM13 |

Sem lacunas detectadas vs o relatório de auditoria.
```
