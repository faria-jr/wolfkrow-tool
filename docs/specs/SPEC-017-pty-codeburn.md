# SPEC-017: PTY / CodeBurn (Terminal Interativo)

**Status**: 📝 Draft
**Camada**: Worker (node-pty) + Web (xterm.js)
**Prioridade**: P1
**Origem LionClaw**: `electron/main/codeburn-pty.ts`, `src/components` terminal
**Fase do plano**: B.5

---

## 1. Visão Geral

Terminal interativo (PTY) para execução de código/comandos. Worker mantém node-pty; bridge WebSocket Worker→Next→browser; UI via xterm.js (já em deps: `@xterm/xterm`, `@xterm/addon-fit`).

### User Stories

- US-1: Rodar comando shell interativo no chat.
- US-2: Resize do terminal reflete no PTY.
- US-3: Múltiplas sessões PTY simultâneas.

---

## 2. Worker

```typescript
// apps/worker/src/pty/server.ts
import { spawn } from 'node-pty';

export class PtyServer {
  private sessions = new Map<string, IPty>();

  create(id: string, opts: PtyOpts): void {
    const pty = spawn(opts.shell, [], { cols: opts.cols, rows: opts.rows, cwd: opts.cwd });
    this.sessions.set(id, pty);
  }
  write(id: string, data: string) { this.sessions.get(id)?.write(data); }
  resize(id: string, cols: number, rows: number) { this.sessions.get(id)?.resize(cols, rows); }
  kill(id: string) { this.sessions.get(id)?.kill(); this.sessions.delete(id); }
}
```

WS protocol: `{ type: 'input'|'resize'|'output'|'exit', ... }`.

---

## 3. Bridge

```
browser (xterm) ──WS──► Next /api/pty/[id] (upgrade) ──WS──► Worker /pty ──► node-pty
```

Auth: JWT no handshake (cookie → query token). Timeout idle → kill.

---

## 4. UI

- `usedPty` hook (`apps/web/lib/ws/usePty.ts`): conecta WS, liga xterm, trata resize via `FitAddon`.
- Componente `Terminal` (xterm container), embutido no chat (CodeBurn).

---

## 5. Segurança

- PTY sandboxed em `cwd` permitido (`.wolfkrow/workspace/`).
- Permission guard: comandos destrutivos exigem confirm (ver SPEC-020).
- Nunca expor PTY sem auth válida.

---

## 6. Testes

- Worker: create/write/resize/kill, cleanup de sessões.
- Bridge: input→output round-trip (integration).
- E2E: abrir terminal, `echo`, ver output, resize.
