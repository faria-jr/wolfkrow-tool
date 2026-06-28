import type {
  HarnessProjectRepo,
  HarnessRoundRepo,
  HarnessSprintRepo,
  SprintFeature,
} from '@wolfkrow/domain';
import { HarnessProject, HarnessRound, HarnessSprint, NotFoundError } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CreateHarnessProjectUseCase,
  DeleteHarnessProjectUseCase,
  EvaluateRoundUseCase,
  GetHarnessProjectUseCase,
  ListHarnessProjectsUseCase,
  PlanSprintsUseCase,
  RunCoderRoundUseCase,
} from '../index';

// ── Fakes ────────────────────────────────────────────────────────────────────

class InMemoryProjectRepo implements HarnessProjectRepo {
  readonly store = new Map<string, HarnessProject>();
  async findAll() {
    return [...this.store.values()];
  }
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string) {
    return [...this.store.values()].filter((p) => p.userId === userId);
  }
  async save(p: HarnessProject) {
    this.store.set(p.id, p);
    return p;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

class InMemorySprintRepo implements HarnessSprintRepo {
  readonly store = new Map<string, HarnessSprint>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByProjectId(projectId: string) {
    return [...this.store.values()].filter((s) => s.projectId === projectId);
  }
  async save(s: HarnessSprint) {
    this.store.set(s.id, s);
    return s;
  }
}

class InMemoryRoundRepo implements HarnessRoundRepo {
  readonly store = new Map<string, HarnessRound>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findBySprintId(sprintId: string) {
    return [...this.store.values()].filter((r) => r.sprintId === sprintId);
  }
  async findBySprintAndFeature(sprintId: string, featureIndex: number) {
    return [...this.store.values()].filter(
      (r) => r.sprintId === sprintId && r.featureIndex === featureIndex
    );
  }
  async save(r: HarnessRound) {
    this.store.set(r.id, r);
    return r;
  }
}

const FEATURES: SprintFeature[] = [
  {
    name: 'Login',
    description: 'User can log in',
    acceptanceCriteria: ['POST /auth/login returns JWT'],
  },
];

// ── CreateHarnessProjectUseCase ───────────────────────────────────────────────

describe('CreateHarnessProjectUseCase', () => {
  it('creates a project in planning state', async () => {
    const repo = new InMemoryProjectRepo();
    const uc = new CreateHarnessProjectUseCase(repo);
    const result = await uc.execute({ userId: 'u1', name: 'AuthSvc', specPath: '/tmp/spec.md' });
    expect(result.project.status).toBe('planning');
    expect(result.project.name).toBe('AuthSvc');
    expect(await repo.findById(result.project.id)).not.toBeNull();
  });
});

// ── GetHarnessProjectUseCase ──────────────────────────────────────────────────

describe('GetHarnessProjectUseCase', () => {
  let repo: InMemoryProjectRepo;
  let projectId: string;

  beforeEach(async () => {
    repo = new InMemoryProjectRepo();
    const p = HarnessProject.create({
      userId: 'u1',
      name: 'P',
      specPath: '/s',
      description: undefined,
      config: { maxRoundsPerFeature: 5, coderModel: 'x', plannerModel: 'y' },
    });
    await repo.save(p);
    projectId = p.id;
  });

  it('finds existing project', async () => {
    const uc = new GetHarnessProjectUseCase(repo);
    const result = await uc.execute({ projectId });
    expect(result.project.id).toBe(projectId);
  });

  it('throws NotFoundError for unknown id', async () => {
    const uc = new GetHarnessProjectUseCase(repo);
    await expect(uc.execute({ projectId: 'none' })).rejects.toThrow(NotFoundError);
  });
});

// ── ListHarnessProjectsUseCase ────────────────────────────────────────────────

describe('ListHarnessProjectsUseCase', () => {
  it('lists projects for user', async () => {
    const repo = new InMemoryProjectRepo();
    await repo.save(
      HarnessProject.create({
        userId: 'u1',
        name: 'A',
        specPath: '/a',
        description: undefined,
        config: { maxRoundsPerFeature: 5, coderModel: 'x', plannerModel: 'y' },
      })
    );
    await repo.save(
      HarnessProject.create({
        userId: 'u2',
        name: 'B',
        specPath: '/b',
        description: undefined,
        config: { maxRoundsPerFeature: 5, coderModel: 'x', plannerModel: 'y' },
      })
    );
    const uc = new ListHarnessProjectsUseCase(repo);
    const result = await uc.execute({ userId: 'u1' });
    expect(result.projects).toHaveLength(1);
  });
});

// ── DeleteHarnessProjectUseCase ───────────────────────────────────────────────

describe('DeleteHarnessProjectUseCase', () => {
  it('deletes project', async () => {
    const repo = new InMemoryProjectRepo();
    const p = HarnessProject.create({
      userId: 'u1',
      name: 'A',
      specPath: '/a',
      description: undefined,
      config: { maxRoundsPerFeature: 5, coderModel: 'x', plannerModel: 'y' },
    });
    await repo.save(p);
    const uc = new DeleteHarnessProjectUseCase(repo);
    await uc.execute({ projectId: p.id, userId: 'u1' });
    expect(await repo.findById(p.id)).toBeNull();
  });

  it('throws NotFoundError', async () => {
    const repo = new InMemoryProjectRepo();
    const uc = new DeleteHarnessProjectUseCase(repo);
    await expect(uc.execute({ projectId: 'bad', userId: 'u1' })).rejects.toThrow(NotFoundError);
  });
});

// ── PlanSprintsUseCase ────────────────────────────────────────────────────────

describe('PlanSprintsUseCase', () => {
  it('creates sprints from planner output', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const sprintRepo = new InMemorySprintRepo();
    const p = HarnessProject.create({
      userId: 'u1',
      name: 'A',
      specPath: '/a',
      description: undefined,
      config: { maxRoundsPerFeature: 5, coderModel: 'x', plannerModel: 'y' },
    });
    await projectRepo.save(p);

    const mockPlanner = {
      plan: vi
        .fn()
        .mockResolvedValue([{ name: 'Sprint 1', description: 'Auth sprint', features: FEATURES }]),
    };
    const uc = new PlanSprintsUseCase(projectRepo, sprintRepo, mockPlanner);
    const result = await uc.execute({ projectId: p.id, specContent: '# Spec\nAuth module' });
    expect(result.sprints).toHaveLength(1);
    expect(result.sprints[0]!.name).toBe('Sprint 1');
    expect(result.sprints[0]!.features).toHaveLength(1);
    const updated = await projectRepo.findById(p.id);
    expect(updated?.status).toBe('ready');
  });

  it('forwards repoSummary to planner.plan when provided', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const sprintRepo = new InMemorySprintRepo();
    const p = HarnessProject.create({
      userId: 'u1',
      name: 'B',
      specPath: '/b',
      description: undefined,
      config: { maxRoundsPerFeature: 3, coderModel: 'x', plannerModel: 'z' },
    });
    await projectRepo.save(p);

    const mockPlanner = {
      plan: vi.fn().mockResolvedValue([{ name: 'Sprint 1', description: 'd', features: FEATURES }]),
    };
    const uc = new PlanSprintsUseCase(projectRepo, sprintRepo, mockPlanner);
    await uc.execute({
      projectId: p.id,
      specContent: '# Spec',
      repoSummary: '5 files | Languages: typescript',
    });

    expect(mockPlanner.plan).toHaveBeenCalledWith(
      '# Spec',
      expect.objectContaining({ repoSummary: '5 files | Languages: typescript' })
    );
  });
});

// ── RunCoderRoundUseCase ──────────────────────────────────────────────────────

describe('RunCoderRoundUseCase', () => {
  it('creates round with coder output', async () => {
    const sprintRepo = new InMemorySprintRepo();
    const roundRepo = new InMemoryRoundRepo();
    const sprint = HarnessSprint.create({
      projectId: 'p1',
      number: 1,
      name: 'S1',
      description: undefined,
      features: FEATURES,
    });
    await sprintRepo.save(sprint);

    const mockCoder = {
      implement: vi.fn().mockResolvedValue({ output: 'code here', tokens: 1000 }),
    };
    const uc = new RunCoderRoundUseCase(sprintRepo, roundRepo, mockCoder);
    const result = await uc.execute({ sprintId: sprint.id, featureIndex: 0, roundNumber: 1 });
    expect(result.round.status).toBe('evaluator_running');
    expect(result.round.coderOutput).toBe('code here');
  });
});

// ── EvaluateRoundUseCase ──────────────────────────────────────────────────────

describe('EvaluateRoundUseCase', () => {
  it('marks round as passed when evaluator approves', async () => {
    const roundRepo = new InMemoryRoundRepo();
    const sprint = HarnessSprint.create({
      projectId: 'p1',
      number: 1,
      name: 'S1',
      description: undefined,
      features: FEATURES,
    });
    const round = HarnessRound.create({ sprintId: sprint.id, featureIndex: 0, roundNumber: 1 });
    const withOutput = round.withCoderOutput('code', 500);
    await roundRepo.save(withOutput);

    const mockEvaluator = {
      evaluate: vi.fn().mockResolvedValue({ passed: true, feedback: 'Looks good!', tokens: 200 }),
    };
    const uc = new EvaluateRoundUseCase(roundRepo, mockEvaluator);
    const result = await uc.execute({ roundId: withOutput.id });
    expect(result.round.status).toBe('passed');
    expect(result.passed).toBe(true);
  });

  it('marks round as failed when evaluator rejects', async () => {
    const roundRepo = new InMemoryRoundRepo();
    const sprint = HarnessSprint.create({
      projectId: 'p1',
      number: 1,
      name: 'S1',
      description: undefined,
      features: FEATURES,
    });
    const round = HarnessRound.create({ sprintId: sprint.id, featureIndex: 0, roundNumber: 1 });
    const withOutput = round.withCoderOutput('bad code', 300);
    await roundRepo.save(withOutput);

    const mockEvaluator = {
      evaluate: vi.fn().mockResolvedValue({ passed: false, feedback: 'Tests fail', tokens: 150 }),
    };
    const uc = new EvaluateRoundUseCase(roundRepo, mockEvaluator);
    const result = await uc.execute({ roundId: withOutput.id });
    expect(result.round.status).toBe('failed');
    expect(result.passed).toBe(false);
    expect(result.round.evaluatorFeedback).toBe('Tests fail');
  });
});
