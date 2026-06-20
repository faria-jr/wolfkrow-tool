# Wolfkrow Tool

> Assistente pessoal de IA — refactor do LionClaw v3 para arquitetura moderna Next.js 15 fullstack + Worker Node.js + Clean Architecture.

## Status

🚧 **Em planejamento** — Fase 0 (scaffolding). Veja [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) para o roadmap detalhado.

## Visão Geral

Wolfkrow Tool é um assistente pessoal de IA self-hosted, single-user, single-machine, com:

- **Chat multi-SDK** (Claude Agent SDK, Claude-compat, Codex SDK, Lion-SDK próprio)
- **Knowledge base** semântica local (PDF, DOCX, CSV, XLSX, MD, URL)
- **Harness system** (Planner→Coder→Evaluator loop automatizado)
- **Pipeline engine** (BuildPlan multi-stage com discovery→spec→validate→approval)
- **Enrich pipeline** (Validator→Enricher para SPEC)
- **Open Design Studio** (sub-app para design de interfaces)
- **Voice conversation** (VAD + STT + TTS em tempo real)
- **Scheduler** com cron tasks
- **Telegram bridge** (bot conversacional)
- **MCP servers** (19+ integrações: Google, ElevenLabs, Excalidraw, YouTube, Shopify, etc)
- **Vault** (segredos via OS keychain)
- **Memory pipeline** (compaction, embeddings, semantic search)

## Arquitetura

```
Browser (Chrome/Edge/Firefox/Safari)
  ↓ HTTP/SSE/WebSocket → localhost:3000
Next.js 15 (UI + API gateway + RSC + shadcn/ui)
  ↓ HTTP/WebSocket → localhost:4000
Worker Node.js (MCPs spawnados, Telegram, scheduler, Whisper, PTY, dreaming)
  ↓
SQLite (.wolfkrow/data/wolfkrow.db) + Keychain (keytar) + Filesystem
```

Veja [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) para detalhes completos.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + shadcn/ui + Tailwind CSS v4 |
| State | Zustand (client) + TanStack Query (server state) |
| API | Next.js Route Handlers + Server Actions + Server Components |
| Streaming | SSE (Server-Sent Events) + WebSocket (PTY) |
| Backend | Node.js 20+ (Worker process) |
| Database | better-sqlite3 + sqlite-vec + Drizzle ORM |
| Auth | bcryptjs + otplib (TOTP) + JWT em cookies HttpOnly |
| AI SDKs | @anthropic-ai/claude-agent-sdk, Claude-compat, Codex SDK, Lion-SDK |
| Embeddings | @anthropic-ai/sdk (Anthropic Embeddings API) |
| Logger | pino |
| Secrets | keytar (OS keychain) |
| Telegram | node-telegram-bot-api |
| Doc parsing | pdf-parse, mammoth, csv-parse, xlsx, turndown |
| Terminal | xterm.js + node-pty |
| Markdown | react-markdown + remark-gfm |
| Icons | lucide-react |
| Tests | vitest + @testing-library/react + Playwright |
| Lint | ESLint 9 + Prettier + Husky + lint-staged |
| Monorepo | Turborepo + pnpm workspaces |
| Distribuição | Electron wrapper mínimo (systray + hotkey) + PWA installable |

## Documentação

- [PRD.md](./docs/PRD.md) — Product Requirements Document
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Arquitetura técnica completa
- [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) — Roadmap faseado (136 dias)
- [AGENT.md](./AGENT.md) — Guia para agentes de IA
- [docs/adr/](./docs/adr/) — Architecture Decision Records (25 ADRs)
- [docs/specs/](./docs/specs/) — Especificações técnicas detalhadas

## Quick Start (quando implementado)

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run development
pnpm dev

# Run tests
pnpm test

# Run E2E
pnpm test:e2e

# Build binary
pnpm dist:mac    # macOS DMG
pnpm dist:win    # Windows NSIS
pnpm dist:linux  # Linux AppImage
```

## Licença

UNLICENSED — Copyright (c) 2026 Wolfkrow Labs.
