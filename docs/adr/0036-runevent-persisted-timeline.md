# ADR-0036: RunEvent — persisted event timeline for console restore

**Status**: ✅ Aceito (2026-06-27)
**Data**: 2026-06-27

## Contexto

Os consoles de run do Harness/Pipeline consumiam **apenas SSE ao vivo**. Se o
operador recarregava a página ou perdia a conexão no meio de um sprint, o console
ficava em branco — todo o histórico de coder/evaluator stream era perdido, mesmo
o run continuando no servidor. Round *results* eram persistidos (aba "Round
history"), mas não a transcrição do stream.

## Decisão

Adicionar um log de eventos append-only persistido, `run_events`, chaveado por
`runRef` (e.g. `harness:<projectId>`):

- Entidade `RunEvent` (domain) + `RunEventRepo` (port) + `DrizzleRunEventRepo`
  (infra) + migration `0014_lethal_blade.sql`.
- `seq` monótono por `runRef` p/ replay determinístico; `payload` é o objeto
  SSE-shaped opaco (não modelamos cada variante de evento).
- O loop SSE do Harness (`harness-sse.ts`) grava cada evento emitido
  (best-effort: falha de persistência nunca quebra o stream ao vivo). Limpa a
  timeline no início de cada run.
- Rota `GET /harness/projects/:id/run-events` + proxy web; o hook
  `useHarnessRun` faz fetch + replay no mount, restaurando o estado do console.

Use-cases: `RecordRunEventUseCase`, `ReplayRunEventsUseCase`,
`ClearRunEventsUseCase` (`packages/use-cases/src/run-events/index.ts`).

## Consequências

### Positivas

- Console restaura após reconnect/refresh (UX operacional sério).
- `payload` opaco evita acoplamento entre schema de evento e domínio.
- Best-effort: o caminho crítico (stream ao vivo) não depende de persistência.

### Negativas / riscos

- Crescimento da tabela: sem GC automático. Mitigação: `deleteByRunRef` no início
  de cada run mantém só o run mais recente por `runRef`; runs antigos podem ser
  purgados por job futuro.
- Apenas Harness grava hoje; Pipeline ainda é SSE-only (próximo passo).

## Alternativas consideradas

- **Replay só dos Round results**: rejeitado — perde o stream do coder/evaluator.
- **Persistir como WorkflowRun.output JSON**: rejeitado — `output` é o resultado
  final, não a timeline de eventos.

## Referências

- `packages/domain/src/entities/run-event.ts`
- `packages/infra/src/db/schema/run-events.ts` + `drizzle/0014_lethal_blade.sql`
- `apps/worker/src/routes/harness-sse.ts` (gravação)
- `apps/web/components/harness/execution-run-hook.ts` (replay no mount)
- Fase 6 do `docs/mvp_final_plan.md`
