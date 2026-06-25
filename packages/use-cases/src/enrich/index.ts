import type { EnrichSession, EnrichSessionRepo } from '@wolfkrow/domain';
import { EnrichSession as EnrichSessionEntity, NotFoundError } from '@wolfkrow/domain';

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface ValidatorAgent {
  validate(input: { specContent: string }): Promise<{ output: string; tokens: number }>;
}

export interface EnricherAgent {
  enrich(input: { specContent: string; validatorOutput: string }): Promise<{ output: string; tokens: number }>;
}

// ── CreateEnrichSession ───────────────────────────────────────────────────────

/**
 * Client-supplied input for creating an enrich session. `userId` is NOT part of
 * this object — it is server-derived from the authenticated session and passed
 * as a separate parameter to `execute`, so a client cannot spoof another user's
 * identity by sending `userId` in the request body.
 */
export interface CreateEnrichSessionInput { specPath: string; validatorAgentId?: string; enricherAgentId?: string; }
export interface CreateEnrichSessionOutput { session: EnrichSession; }

export class CreateEnrichSessionUseCase {
  constructor(private readonly repo: EnrichSessionRepo) {}
  async execute(userId: string, input: CreateEnrichSessionInput): Promise<CreateEnrichSessionOutput> {
    const session = await this.repo.save(EnrichSessionEntity.create({ userId, ...input }));
    return { session };
  }
}

// ── GetEnrichSession ──────────────────────────────────────────────────────────

export class GetEnrichSessionUseCase {
  constructor(private readonly repo: EnrichSessionRepo) {}
  async execute(input: { sessionId: string }): Promise<{ session: EnrichSession }> {
    const session = await this.repo.findById(input.sessionId);
    if (!session) throw new NotFoundError('EnrichSession', input.sessionId);
    return { session };
  }
}

// ── ListEnrichSessions ────────────────────────────────────────────────────────

export class ListEnrichSessionsUseCase {
  constructor(private readonly repo: EnrichSessionRepo) {}
  async execute(input: { userId: string }): Promise<{ sessions: EnrichSession[] }> {
    return { sessions: await this.repo.findByUserId(input.userId) };
  }
}

// ── RunValidator ──────────────────────────────────────────────────────────────

export class RunValidatorUseCase {
  constructor(private readonly repo: EnrichSessionRepo, private readonly agent: ValidatorAgent) {}

  async execute(input: { sessionId: string; specContent: string }): Promise<{ session: EnrichSession; output: string }> {
    const session = await this.repo.findById(input.sessionId);
    if (!session) throw new NotFoundError('EnrichSession', input.sessionId);

    const t0 = Date.now();
    const started = await this.repo.save(session.startValidator());
    const result = await this.agent.validate({ specContent: input.specContent });
    const updated = await this.repo.save(started.completeValidator(result.tokens, Date.now() - t0));
    return { session: updated, output: result.output };
  }
}

// ── RunEnricher ───────────────────────────────────────────────────────────────

export class RunEnricherUseCase {
  constructor(private readonly repo: EnrichSessionRepo, private readonly agent: EnricherAgent) {}

  async execute(input: { sessionId: string; specContent: string; validatorOutput: string }): Promise<{ session: EnrichSession; output: string }> {
    const session = await this.repo.findById(input.sessionId);
    if (!session) throw new NotFoundError('EnrichSession', input.sessionId);

    const t0 = Date.now();
    const started = await this.repo.save(session.startEnricher());
    const result = await this.agent.enrich({ specContent: input.specContent, validatorOutput: input.validatorOutput });
    const updated = await this.repo.save(started.completeEnricher(result.tokens, Date.now() - t0));
    return { session: updated, output: result.output };
  }
}

// ── CancelEnrichSession ───────────────────────────────────────────────────────

export class CancelEnrichSessionUseCase {
  constructor(private readonly repo: EnrichSessionRepo) {}
  async execute(input: { sessionId: string; userId: string }): Promise<void> {
    const session = await this.repo.findById(input.sessionId);
    if (!session || session.userId !== input.userId) throw new NotFoundError('EnrichSession', input.sessionId);
    await this.repo.save(session.cancel());
  }
}
