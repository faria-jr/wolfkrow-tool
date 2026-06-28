import type { EnrichSessionRepo } from '@wolfkrow/domain';
import { EnrichSession, NotFoundError } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import {
  CancelEnrichSessionUseCase,
  CreateEnrichSessionUseCase,
  GetEnrichSessionUseCase,
  ListEnrichSessionsUseCase,
  RunEnricherUseCase,
  RunValidatorUseCase,
} from '../index';

class InMemoryEnrichRepo implements EnrichSessionRepo {
  readonly store = new Map<string, EnrichSession>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(u: string) {
    return [...this.store.values()].filter((s) => s.userId === u);
  }
  async save(s: EnrichSession) {
    this.store.set(s.id, s);
    return s;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

describe('CreateEnrichSessionUseCase', () => {
  it('creates session in pending state', async () => {
    const repo = new InMemoryEnrichRepo();
    const { session } = await new CreateEnrichSessionUseCase(repo).execute('u1', {
      specPath: '/spec.md',
    });
    expect(session.status).toBe('pending');
    expect(session.specPath).toBe('/spec.md');
    expect(session.userId).toBe('u1');
  });
});

describe('GetEnrichSessionUseCase', () => {
  it('returns session', async () => {
    const repo = new InMemoryEnrichRepo();
    const s = EnrichSession.create({ userId: 'u1', specPath: '/s' });
    await repo.save(s);
    const { session } = await new GetEnrichSessionUseCase(repo).execute({ sessionId: s.id });
    expect(session.id).toBe(s.id);
  });

  it('throws NotFoundError', async () => {
    await expect(
      new GetEnrichSessionUseCase(new InMemoryEnrichRepo()).execute({ sessionId: 'x' })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ListEnrichSessionsUseCase', () => {
  it('filters by userId', async () => {
    const repo = new InMemoryEnrichRepo();
    await repo.save(EnrichSession.create({ userId: 'u1', specPath: '/a' }));
    await repo.save(EnrichSession.create({ userId: 'u2', specPath: '/b' }));
    const { sessions } = await new ListEnrichSessionsUseCase(repo).execute({ userId: 'u1' });
    expect(sessions).toHaveLength(1);
  });
});

describe('RunValidatorUseCase', () => {
  it('starts validator and stores output', async () => {
    const repo = new InMemoryEnrichRepo();
    const s = await repo.save(EnrichSession.create({ userId: 'u1', specPath: '/s' }));
    const mockAgent = {
      validate: vi.fn().mockResolvedValue({ output: 'Looks valid', tokens: 500 }),
    };

    const { session } = await new RunValidatorUseCase(repo, mockAgent).execute({
      sessionId: s.id,
      specContent: '# Spec',
    });
    expect(session.status).toBe('validator');
    expect(session.validatorMetrics.tokens).toBe(500);
    expect(mockAgent.validate).toHaveBeenCalledWith({ specContent: '# Spec' });
  });
});

describe('RunEnricherUseCase', () => {
  it('runs enricher after validator', async () => {
    const repo = new InMemoryEnrichRepo();
    let s = EnrichSession.create({ userId: 'u1', specPath: '/s' });
    s = s.startValidator().completeValidator(100, 500);
    await repo.save(s);
    const mockAgent = {
      enrich: vi.fn().mockResolvedValue({ output: 'Enriched spec', tokens: 800 }),
    };

    const { session } = await new RunEnricherUseCase(repo, mockAgent).execute({
      sessionId: s.id,
      validatorOutput: 'ok',
      specContent: '# Spec',
    });
    expect(session.status).toBe('completed');
    expect(session.enricherMetrics.tokens).toBe(800);
  });
});

describe('CancelEnrichSessionUseCase', () => {
  it('cancels session', async () => {
    const repo = new InMemoryEnrichRepo();
    const s = await repo.save(EnrichSession.create({ userId: 'u1', specPath: '/s' }));
    await new CancelEnrichSessionUseCase(repo).execute({ sessionId: s.id, userId: 'u1' });
    const updated = await repo.findById(s.id);
    expect(updated?.status).toBe('cancelled');
  });
});
