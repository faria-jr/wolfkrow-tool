# SPEC-020: Permissions + Audit Log

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Web
**Prioridade**: P1
**Origem LionClaw**: `electron/main/permission-guard.ts`, schema `audit_log`, `src/pages/PermissionsPage.tsx`
**Fase do plano**: S.3

---

## 1. Visão Geral

1. **Permissions**: whitelist/blacklist de tools por agent; resolver allow/deny/ask para cada tool call.
2. **Audit log**: toda tool call registrada (correlation-id, agent, tool, input hash, resultado).

### User Stories

- US-1: Bloquear `Bash` para o agent "researcher".
- US-2: Exigir confirmação antes de `rm`/`git push`/`send email`.
- US-3: Auditar o que cada agent executou.

---

## 2. Domain

```typescript
// packages/domain/src/services/permission-resolver.ts
export type PermissionResult =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'ask'; prompt: string };

export class PermissionResolver {
  resolve(agent: Agent, tool: ToolName, input: unknown): PermissionResult {
    if (agent.blacklist.includes(tool)) return { type: 'deny', reason: 'blacklisted' };
    if (DESTRUCTIVE.has(tool)) return { type: 'ask', prompt: describe(tool, input) };
    if (SAFE.has(tool)) return { type: 'allow' };
    if (agent.whitelist.includes(tool)) return { type: 'allow' };
    return { type: 'deny', reason: 'not allowed' };
  }
}
```

Regras: Safe (Read/Grep/Glob/Web*) → allow; Write/Edit em path permitido → allow; destrutivo (rm/sudo/send/push) → ask; desconhecido → deny.

---

## 3. Use-cases

```
ResolvePermission · UpdateAgentPermissions · RecordAuditEntry · QueryAuditLog
```

`RecordAuditEntry`: chamado pelo orchestrator a cada tool call (antes/depois), grava `audit_log` com correlation-id.

---

## 4. UI

- `permissions/page.tsx`: por agent, whitelist/blacklist (multi-select tools), preview do resolver.
- Audit: tabela filtrável (agent, tool, data, resultado) — pode ficar em `logs/` ou aba própria.

---

## 5. Testes

- `PermissionResolver.resolve` — matriz completa (safe/destrutivo/whitelist/blacklist/unknown) ≥95%.
- `RecordAuditEntry` idempotente; correlation-id presente.
- E2E: tool destrutivo dispara confirm dialog.

---

## 6. Segurança

PermissionResolver é a fronteira de segurança das tool calls. `deny` é o default seguro. Audit é append-only (sem update/delete).
