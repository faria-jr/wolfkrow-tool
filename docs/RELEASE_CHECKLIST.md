# Wolfkrow v1.0 — Release Checklist

## Code quality gates

- [x] All tests passing — `pnpm exec turbo test --force`
  - use-cases: 175/175 ✅
  - worker: 142/142 ✅
  - web: 337/337 ✅
- [x] Lint passing — `pnpm exec turbo lint`
- [x] Typecheck passing — `pnpm exec turbo typecheck`
- [x] No `eslint-disable` without justification comment
- [x] No unused `any` types in application code (M7.3)
- [x] `max-lines: 300` satisfied in all modified files (M7.2)
- [x] `max-params: 4` satisfied in all constructors/functions (M7.1)

## Architecture gates

- [x] No infra imports in domain or use-case layers (M7.1)
- [x] No infra imports in route handlers — only via DI container (M7.1)
- [x] Domain interfaces used for repository injection in managers (M7.1)
- [x] EventBus wired in `SendMessageUseCase` — `message.turn.completed` published (M7.1)
- [x] Permission store has TTL (5 min auto-deny) + shutdown drain (M7.6)
- [x] Structured logging in worker (Pino) and wrapper (lightweight logger) (M7.4)

## Security gates

- [x] No secrets hardcoded — vault via keytar only
- [x] JWT middleware active on all protected routes
- [x] JWKS keypair persists across restarts (G2 fix)
- [x] AES-256-GCM + PBKDF2 for vault backup (FIX-007)
- [x] Auth middleware in `middleware.ts` + layout `getSession` (G1 fix)
- [x] Tool permission TTL prevents stale permission requests (M7.6)
- [ ] Manual security test: TOTP enrollment + login flow
- [ ] Manual security test: vault backup + restore

## Build gates

- [ ] Production build: `pnpm build` — all packages build without errors
- [ ] Electron build macOS: `pnpm dist:mac`
- [ ] Electron build Windows: `pnpm dist:win`
- [ ] Auto-update feed configured (GitHub Releases URL in `electron-builder.yml`)

## Functional smoke tests (manual)

- [ ] Onboarding: fresh install → set password → select provider → vault key → chat works
- [ ] Chat: send message → streaming response → token usage recorded
- [ ] Agents: create agent → assign to chat → response uses agent system prompt
- [ ] MCP servers: start/stop knowledge-base MCP; query returns result
- [ ] Memory: memory created after session → Summaries tab shows summary → Compact Now works
- [ ] Scheduler: create cron task → fires at next interval → run appears in review queue
- [ ] Voice: microphone → STT → response → TTS plays
- [ ] Audit log: tool call made → appears in audit log table → CSV export works
- [ ] Vault: add secret → retrieve in agent → backup encrypted file created
- [ ] PWA: install via browser → loads offline (static assets cached)
- [ ] Electron: launch via DMG → tray appears → hotkey opens/hides window

## Browser compatibility

- [ ] Chrome 124+
- [ ] Edge 124+
- [ ] Firefox 125+
- [ ] Safari 17.4+ (PWA)

## Pre-release

- [x] CHANGELOG.md updated
- [x] ADRs complete for all major decisions (ADR-0001 through ADR-0032)
- [x] FEATURE_MATRIX reconciled with code state
- [x] MIGRATION_FROM_LIONCLAW updated with Node 24 + new providers + new tables
- [x] PRD section 2.2 updated with descoped v1.1+ items
- [ ] Git tag `v1.0.0` on `main` after PR merged
- [ ] GitHub Release created with CHANGELOG.md content
- [ ] Update stale v1.0.0 tag (pre-fixes) → re-tag after all fixes merged

## Known issues deferred to v1.1

- Harness AI execution loop (Planner→Coder→Evaluator) is UI-only; no auto-execution
- Memory search UI not implemented
- Audit log advanced filters not implemented
- Knowledge benchmark removed (see ADR-0032)
- Pipeline report not implemented
- Excalidraw inline embedding in chat not implemented
- Artifact detection for tool results not implemented
- Pricing calculator multi-source comparison not implemented
- G4: business logic temp/model still in agent-executor (partial fix)
