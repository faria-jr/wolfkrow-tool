# SPEC-019: Logs (Live Tail)

**Status**: 📝 Draft
**Camada**: Worker (SSE) + Web
**Prioridade**: P2
**Origem LionClaw**: `electron/main/logger.ts`, `src/pages/LogsPage.tsx`
**Fase do plano**: S.3

---

## 1. Visão Geral

System logs filtráveis com live tail via SSE. Pino estruturado (JSON) no backend; UI tail em tempo real com filtros (level, módulo, correlation-id).

### User Stories

- US-1: Ver logs do worker em tempo real.
- US-2: Filtrar por level (error/warn) e módulo.
- US-3: Buscar por correlation-id de uma request.

---

## 2. Worker (SSE)

```typescript
// apps/worker/src/routes/logs.ts
export async function logsRoutes(server: AuthFastifyInstance) {
  server.get('/stream', { preHandler: [server.authenticate] }, async (req, reply) => {
    reply.sse(); // text/event-stream
    const off = logBus.subscribe((entry) => reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`));
    req.raw.on('close', off);
  });
}
```

`logBus`: ring buffer in-memory (últimos N) + pub/sub; Pino transport escreve no bus.

---

## 3. Observabilidade (transversal)

- **Correlation-id** em toda request (middleware) — propagado web→worker→logs.
- Pino `redact` para secrets (nunca logar value de vault/keys).
- Levels: trace/debug/info/warn/error/fatal.

---

## 4. UI

- `logs/page.tsx` (Client: SSE) + filtros (Select level, Input módulo, Input correlation-id) + `ScrollArea` virtualizado + pausar/retomar tail.

---

## 5. Testes

- `logBus` ring buffer (overflow descarta antigos) + pub/sub.
- Redact: secret nunca aparece no stream.
- E2E: gerar log, ver no tail, filtrar.

---

## 6. Segurança

Logs podem conter dados sensíveis → auth obrigatória; redact de secrets é **blocker** se ausente (regra no-secrets).
