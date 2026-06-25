# Architecture Decision Records

We use ADRs to document significant architectural decisions. See [README.md](./README.md) for the full list and process.

## Current ADRs

- [ADR-0001](./0001-use-nextjs-15.md) — Next.js 15 as primary framework
- [ADR-0002](./0002-monorepo-turborepo-pnpm.md) — Turborepo + pnpm workspaces
- [ADR-0003](./0003-clean-architecture-layers.md) — Clean Architecture with 4 isolated layers
- [ADR-0004](./0004-drizzle-orm-for-sqlite.md) — Drizzle ORM for SQLite
- [ADR-0005](./0005-zod-schemas-single-source-of-truth.md) — Zod schemas as single source of truth
- [ADR-0006](./0006-shadcn-ui-component-library.md) — shadcn/ui component library
- [ADR-0007](./0007-tailwind-css-v4.md) — Tailwind CSS v4
- [ADR-0008](./0008-zustand-client-state.md) — Zustand for client state
- [ADR-0009](./0009-tanstack-query-server-state.md) — TanStack Query for server state
- [ADR-0010](./0010-server-components-for-readonly.md) — Server Components for read-only
- [ADR-0011](./0011-server-actions-for-mutations.md) — Server Actions for mutations
- [ADR-0012](./0012-sse-for-streaming.md) — SSE for unidirectional streaming
- [ADR-0013](./0013-websocket-for-bidirectional.md) — WebSocket for bidirectional
- [ADR-0014](./0014-worker-process-pattern.md) — Worker Node.js process pattern
- [ADR-0015](./0015-keytar-for-secrets.md) — keytar for OS keychain secrets
- [ADR-0016](./0016-better-sqlite3-database.md) — better-sqlite3 as database engine
- [ADR-0017](./0017-jwt-cookie-authentication.md) — JWT in HttpOnly cookies
- [ADR-0018](./0018-electron-wrapper-thin-shell.md) — Electron wrapper (thin shell)
- [ADR-0019](./0019-pwa-installable.md) — PWA installable
- [ADR-0020](./0020-tdd-workflow.md) — TDD mandatory (RED → GREEN → REFACTOR)
- [ADR-0021](./0021-vitest-testing-framework.md) — Vitest test runner
- [ADR-0022](./0022-playwright-e2e.md) — Playwright E2E tests
- [ADR-0023](./0023-eslint-prettier-husky.md) — ESLint + Prettier + Husky
- [ADR-0024](./0024-yaml-seed-agents.md) — YAML for seed agents
- [ADR-0025](./0025-domain-events-bus.md) — Domain events bus
- [ADR-0026](./0026-worker-process-vs-electron-renderer.md) — Worker Node (Cenário A) vs Next renderer no Electron (Cenário B)
- [ADR-0027](./0027-workflow-feature-decision.md) — Workflow: feature viva ou schema morto (proposto)
- [ADR-0029](./0029-node-24-runtime.md) — Node 24 as official runtime
- [ADR-0030](./0030-claude-compat-providers.md) — Claude-compat providers (Z.ai, Moonshot, Qwen, MiniMax)
- [ADR-0031](./0031-defer-higgsfield-blotato.md) — Defer Higgsfield + Blotato MCPs to v2
- [ADR-0032](./0032-remove-knowledge-benchmark.md) — Remove knowledge benchmark from v1.0
- [ADR-0033](./0033-mgraph-structured-vault-out-of-scope-v1.md) — Structured mgraph vault (ROAM-like) out of scope for v1.0

## Process

1. Create issue with template `.github/ISSUE_TEMPLATE/adr.md`
2. Discuss in issue + PR
3. Once accepted, create ADR file with next sequential number
4. Update this README with link
5. ADRs are immutable after accepted — changes require new ADR that supersedes
