# ADR-0026: Worker Node Separado (Cenário A) vs Next.js como Renderer no Electron (Cenário B)

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

A análise original do refactor (`lionclawv1.0/.docs/wolfkrow-refactor/analysis.md`) avaliou dois cenários e **recomendou o Cenário B**. O projeto, porém, foi implementado seguindo o **Cenário A** (web + Worker Node + wrapper Electron fino), sem ADR registrando a decisão. Este ADR formaliza e justifica a escolha, com os trade-offs explícitos.

### Cenário A — Next.js standalone + Worker Node + wrapper Electron fino
```
Browser → Next.js server (RSC, Route Handlers, Server Actions) → Worker Node (:4000)
Electron wrapper (~300 linhas) só spawna Next+Worker e dá systray/hotkey.
```

### Cenário B — Next.js como renderer dentro do Electron
```
Electron main (Node, todo o backend) ←IPC→ Next.js (apenas UI no BrowserWindow)
Zero Worker, zero servidor HTTP intermediário. Recomendado pela análise: "zero funcionalidades perdidas".
```

## Decisão

**Cenário A — Worker Node separado.**

Razões que pesaram mais que a recomendação original:

1. **PWA / acesso web**: A só permite rodar 100% no browser (`localhost:3000`) sem Electron — habilita PWA installable, self-hosted e futuro acesso multi-device. B amarra a UI ao processo Electron.
2. **Separação de responsabilidades**: Worker long-running isola jobs de background (scheduler, dreaming, MCPs, telegram) do ciclo de request do Next — alinhado a Clean Architecture e ADR-0014 (worker pattern).
3. **Escalabilidade de distribuição** (PRD §6): mesma base serve PWA, binário Electron e (futuro) cloud self-hosted. B serve só desktop.
4. **Testabilidade**: Worker é um servidor HTTP testável isoladamente (Fastify + supertest), sem precisar de harness Electron.

## Consequências

### Positivas
- PWA + web + desktop a partir da mesma base.
- Background jobs isolados e resilientes (Worker sobrevive a reload da UI).
- Worker testável sem Electron; menos acoplamento ao framework desktop.

### Negativas
- **Sistema distribuído single-machine**: 3 processos (browser, Next, Worker) com proxy SSE/WS Next↔Worker.
- **Mais superfícies de falha**: SSE bloqueado em corporate firewall; throttling de SSE em background tab; cookie cross-origin para o sidecar.
- **Auth mais complexa**: JWT precisa ser verificável por web E worker (JWKS compartilhado) — ver bug B1 (keypair efêmero) que esta arquitetura torna crítico.
- Mais boilerplate (HTTP proxy nas Route Handlers).

### Mitigações
- **SSE firewall/throttling**: fallback long-polling + Service Worker mantendo conexão; documentar "manter tab aberta".
- **Auth distribuída**: keypair ES256 **persistido** (keytar) com endpoint JWKS estável; worker valida via JWKS. (Tarefa F.4 do plano.)
- **Latência proxy**: Worker em `127.0.0.1`, overhead <5ms; streaming repassado sem buffering.
- **Falha do Worker**: wrapper Electron faz health-check + restart; web mostra estado degradado.

## Alternativas Consideradas

### B. Next.js como renderer no Electron (recomendado na análise)
- **Prós**: zero perda de funcionalidade, menos partes móveis, sem proxy HTTP, auth trivial (IPC).
- **Contras**: sem PWA/web, UI presa ao Electron, backend no main process tende a virar god object (foi o problema do LionClaw), testes exigem harness Electron.
- **Decisão**: ❌ Rejeitado — perde o vetor PWA/web e o isolamento de background jobs, que são objetivos de produto (PRD §1.4, §6).

### C. Híbrido (Worker embutido no Next server, sem processo separado)
- **Prós**: 2 processos em vez de 3.
- **Contras**: jobs longos (dreaming, MCPs) competem com o event loop do Next; reload da UI mata jobs.
- **Decisão**: ❌ Rejeitado — background não-resiliente.

## Reavaliação

Revisar após M1: se SSE em firewall/throttling provar inviável na prática, reconsiderar B para o modo desktop mantendo A para web (build dual). Gatilho: >20% dos beta testers com falha de streaming.

## Referências

- `lionclawv1.0/.docs/wolfkrow-refactor/analysis.md` §2.1 (Cenários A vs B)
- ADR-0014 (Worker process pattern), ADR-0018 (Electron wrapper fino)
- ADR-0012 (SSE), ADR-0013 (WebSocket), ADR-0017 (JWT cookie auth)
