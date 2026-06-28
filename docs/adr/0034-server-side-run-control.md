# ADR-0034: Server-side run control (abort / pause / resume) for long-running workflows

**Status**: ✅ Aceito (2026-06-27)
**Data**: 2026-06-27

## Contexto

Harness e Pipeline rodam loops de IA longos (coder→evaluator por feature, fases
de spec→design→implementação). Antes desta decisão, o único controle de execução
era o `reader.cancel()` no cliente — que apenas derruba o *consumer* SSE. O loop
de IA caro continuava rodando no worker, queimando tokens e gravando arquivos
depois do usuário ter "parado". Não havia pause/resume.

O Harness já tinha um abort server-side isolado (`apps/worker/src/harness/run-registry.ts`,
DEBT #29), mas era específico e sem pause/resume. O Pipeline não tinha nenhum dos
três.

## Decisão

Padronizar o controle de execução num módulo compartilhado
`apps/worker/src/lib/run-control.ts` com state machine
`running ↔ paused → aborted`:

- `registerRun(id) → RunHandle` (loop consulta `isAborted()` / `waitIfPaused()` entre passos)
- `abortRun / pauseRun / resumeRun / runState / unregisterRun`

O `run-registry` do Harness vira um shim fino sobre o run-control (API legada
`registerRun/abortRun/unregisterRun` preservada — zero breaking changes). O
Pipeline adota o mesmo módulo, registrado por `phaseId`.

Rotas expostas (worker + proxy web):
- `POST /pipeline/.../abort | pause | resume`
- `GET  /pipeline/.../run-state`
- Harness mantém `POST /harness/.../abort` (legado).

## Consequências

### Positivas

- Parar um run realmente para o loop de IA (economia de tokens + I/O).
- Pause/resume permitem HITL sem reiniciar o sprint/fase.
- Um único módulo testado cobre Harness + Pipeline (8 testes unitários).
- API legada do Harness inalterada — sem regressão.

### Negativas / riscos

- Estado em memória por processo: adequado p/ deploy single-worker; multi-instance
  exigiria store compartilhado (Redis). Documentado no módulo.
- Pause só é observado entre passos do loop (não interrompe uma chamada de
  provider em andamento) — aceitável p/ UX de HITL.

## Alternativas consideradas

- **Abort só no cliente**: rejeitado — não para o loop server-side (problema original).
- **Store compartilhado desde já**: rejeitado — over-engineering p/ MVP single-worker.

## Referências

- DEBT #29 (server-side abort original do Harness)
- `apps/worker/src/lib/run-control.ts`
- `apps/worker/src/routes/pipeline-run-control.ts`
- Fase 6/7 do `docs/mvp_final_plan.md`
