# Specifications

Technical specifications for each feature/component of Wolfkrow Tool.

## Current Specs

- [SPEC-001](./SPEC-001-authentication.md) — Authentication + TOTP + Auto-lock
- [SPEC-002](./SPEC-002-chat-streaming.md) — Chat with SSE streaming
- [SPEC-003](./SPEC-003-voice-conversation.md) — Voice conversation (STT + TTS + VAD)
- [SPEC-004](./SPEC-004-knowledge-engine.md) — Knowledge engine (local RAG)
- [SPEC-005](./SPEC-005-harness-system.md) — Harness system (Planner→Coder→Evaluator)
- [SPEC-006](./SPEC-006-pipeline-engine.md) — Pipeline engine (BuildPlan)
- [SPEC-007](./SPEC-007-open-design-studio.md) — Open Design Studio (sidecar)
- [SPEC-008](./SPEC-008-mcp-manager.md) — MCP manager (19+ servers)
- [SPEC-009](./SPEC-009-scheduler.md) — Scheduler (cron tasks)
- [SPEC-010](./SPEC-010-telegram-bridge.md) — Telegram bridge
- [SPEC-011](./SPEC-011-vault-secrets.md) — Vault (secrets via keytar)
- [SPEC-012](./SPEC-012-electron-wrapper.md) — Electron wrapper
- [SPEC-013](./SPEC-013-sub-agents.md) — Sub-Agents (custom AI personas)
- [SPEC-014](./SPEC-014-skills-seed-agents.md) — Skills + Seed-Agents (YAML)
- [SPEC-015](./SPEC-015-memory-dreaming.md) — Memory pipeline + Dreaming
- [SPEC-016](./SPEC-016-enrich-workflow.md) — Enrich pipeline + Workflow
- [SPEC-017](./SPEC-017-pty-codeburn.md) — PTY / CodeBurn (terminal)
- [SPEC-018](./SPEC-018-usage-pricing.md) — Usage + Pricing calculator
- [SPEC-019](./SPEC-019-logs.md) — Logs (live tail)
- [SPEC-020](./SPEC-020-permissions-audit.md) — Permissions + Audit log
- [SPEC-021](./SPEC-021-rules.md) — Rules (global editable rules) — **gap fechado**
- [SPEC-022](./SPEC-022-graph-view.md) — Graph view (knowledge graph) — **gap fechado**

## Format

Each SPEC follows:

1. **Visão Geral**: What and why
2. **Requisitos Funcionais**: User stories + acceptance criteria
3. **Requisitos Não-Funcionais**: Performance, security, scalability
4. **Arquitetura**: Components, flows, diagrams
5. **API Contracts**: Zod schemas, IPC payloads
6. **Database Schema**: Tables, indices, migrations
7. **UI/UX**: Wireframes, components, states
8. **Testes**: Unit, integration, E2E
9. **Riscos**: Known issues + mitigations
10. **Open Questions**: Pending decisions

## Process

1. Create SPEC before any implementation
2. SPEC should be reviewed by tech lead
3. Update SPEC as implementation reveals new details
4. Reference SPEC in related PRs
5. SPECs are living documents — update as design evolves
