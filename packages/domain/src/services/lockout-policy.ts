/**
 * Política de lockout (A.1): 5 tentativas falhas → bloqueio 5 min.
 * Domain service puro (sem I/O) — encapsula a regra, User a aplica.
 */
export class LockoutPolicy {
  constructor(
    readonly maxAttempts = 5,
    readonly lockDurationMs = 5 * 60 * 1000,
  ) {}

  /** Após N falhas, deve bloquear? */
  shouldLock(failedAttempts: number): boolean {
    return failedAttempts >= this.maxAttempts;
  }

  /** Instante de desbloqueio (ISO) a partir de agora. */
  lockUntil(now: Date): string {
    return new Date(now.getTime() + this.lockDurationMs).toISOString();
  }
}
