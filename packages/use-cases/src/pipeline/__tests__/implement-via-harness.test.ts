import type {
  HarnessProjectRepo,
  HarnessSprintRepo,
  PipelinePhaseRepo,
  PipelineProjectRepo,
  HarnessProject,
  HarnessSprint,
} from '@wolfkrow/domain';
import { PipelinePhase, PipelineProject, type SprintFeature } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import type { HarnessPlanner, PlannerSprintData } from '../../harness/plan-sprints';
import { ImplementViaHarnessUseCase } from '../implement-via-harness';

class InMemoryPipelineProjectRepo implements PipelineProjectRepo {
  readonly store = new Map<string, PipelineProject>();
  async findAll() {
    return [...this.store.values()];
  }
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(u: string) {
    return [...this.store.values()].filter((p) => p.userId === u);
  }
  async save(p: PipelineProject) {
    this.store.set(p.id, p);
    return p;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

class InMemoryPipelinePhaseRepo implements PipelinePhaseRepo {
  readonly store = new Map<string, PipelinePhase>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByProjectId(pid: string) {
    return [...this.store.values()].filter((p) => p.projectId === pid);
  }
  async save(p: PipelinePhase) {
    this.store.set(p.id, p);
    return p;
  }
}

class InMemoryHarnessProjectRepo implements HarnessProjectRepo {
  readonly store = new Map<string, HarnessProject>();
  async findAll() {
    return [...this.store.values()];
  }
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(u: string) {
    return [...this.store.values()].filter((p) => p.userId === u);
  }
  async save(p: HarnessProject) {
    this.store.set(p.id, p);
    return p;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

class InMemoryHarnessSprintRepo implements HarnessSprintRepo {
  readonly store = new Map<string, HarnessSprint>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByProjectId(pid: string) {
    return [...this.store.values()].filter((s) => s.toProps().projectId === pid);
  }
  async save(s: HarnessSprint) {
    this.store.set(s.id, s);
    return s;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

class StubPlanner implements HarnessPlanner {
  constructor(private readonly sprintData: PlannerSprintData[]) {}
  async plan() {
    return this.sprintData;
  }
}

function makeFeature(name: string): SprintFeature {
  return { name, description: '', acceptanceCriteria: [] };
}

function makeUc(deps: {
  projectRepo: InMemoryPipelineProjectRepo;
  phaseRepo: InMemoryPipelinePhaseRepo;
  harnessProjectRepo: InMemoryHarnessProjectRepo;
  harnessSprintRepo: InMemoryHarnessSprintRepo;
  planner: HarnessPlanner;
}): ImplementViaHarnessUseCase {
  return new ImplementViaHarnessUseCase({
    pipelineProjectRepo: deps.projectRepo,
    pipelinePhaseRepo: deps.phaseRepo,
    harnessProjectRepo: deps.harnessProjectRepo,
    harnessSprintRepo: deps.harnessSprintRepo,
    planner: deps.planner,
  });
}

describe('ImplementViaHarnessUseCase (M5.7)', () => {
  let projectRepo: InMemoryPipelineProjectRepo;
  let phaseRepo: InMemoryPipelinePhaseRepo;
  let harnessProjectRepo: InMemoryHarnessProjectRepo;
  let harnessSprintRepo: InMemoryHarnessSprintRepo;

  beforeEach(() => {
    projectRepo = new InMemoryPipelineProjectRepo();
    phaseRepo = new InMemoryPipelinePhaseRepo();
    harnessProjectRepo = new InMemoryHarnessProjectRepo();
    harnessSprintRepo = new InMemoryHarnessSprintRepo();
  });

  it('creates a Harness project + plans sprints + persists harnessProjectId', async () => {
    const project = PipelineProject.create({ userId: 'u1', name: 'P' }).withStage('approval', {
      status: 'awaiting_approval',
      specEdits: '# Final Spec\n\nUse Postgres + TypeScript.',
    });
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    const planner = new StubPlanner([
      {
        name: 'Sprint 1',
        description: 'auth',
        features: [makeFeature('login'), makeFeature('logout')],
      },
      { name: 'Sprint 2', description: 'billing', features: [makeFeature('stripe')] },
    ]);
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });

    const result = await uc.execute({ projectId: project.id, phaseId: phase.id });

    expect(result.harness.toProps().userId).toBe('u1');
    expect(result.harness.toProps().name).toBe('P');
    expect(result.sprints).toHaveLength(2);
    expect(result.sprints[0]?.toProps().features).toHaveLength(2);
    expect(result.pipeline.toProps().currentStage).toBe('completed');
    expect(result.pipeline.toProps().status).toBe('completed');
    expect(result.pipeline.toProps().harnessProjectId).toBe(result.harness.toProps().id);
    expect(result.artifact).toContain('Sprint 1');
    expect(result.artifact).toContain(result.harness.toProps().id);
  });

  it('uses inlineSpec when provided (overrides specEdits)', async () => {
    const project = PipelineProject.create({ userId: 'u1', name: 'P' }).withStage('approval', {
      status: 'awaiting_approval',
      specEdits: '# Old spec',
    });
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    let captured = '';
    const planner: HarnessPlanner = {
      async plan(specContent) {
        captured = specContent;
        return [];
      },
    };
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });

    await uc.execute({
      projectId: project.id,
      phaseId: phase.id,
      inlineSpec: '# Inline override',
    });
    expect(captured).toBe('# Inline override');
  });

  it('falls back to discovery notes + name when no spec available', async () => {
    const project = PipelineProject.create({ userId: 'u1', name: 'Phoenix' }).withStage(
      'approval',
      {
        status: 'awaiting_approval',
        discoveryNotes: 'Key user: solo founder.',
      }
    );
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    let captured = '';
    const planner: HarnessPlanner = {
      async plan(specContent: string) {
        captured = specContent;
        return [];
      },
    };
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });
    await uc.execute({ projectId: project.id, phaseId: phase.id });
    expect(captured).toContain('Phoenix');
    expect(captured).toContain('Key user: solo founder.');
  });

  it('marks the implementation phase as completed with artifact path', async () => {
    const project = PipelineProject.create({ userId: 'u1', name: 'P' });
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    const planner = new StubPlanner([{ name: 'S1', description: 'd', features: [] }]);
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });
    const result = await uc.execute({ projectId: project.id, phaseId: phase.id });
    expect(result.phase.toProps().status).toBe('completed');
    expect(result.phase.toProps().artifactPath).toBe(`harness:${phase.id}`);
    expect(result.phase.toProps().metrics.tokens).toBe(result.artifact.length);
  });

  it('propagates projectPath from pipeline project to harness project (F2.3)', async () => {
    const project = PipelineProject.create({
      userId: 'u1',
      name: 'P',
      projectPath: '/Users/me/my-repo',
    });
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    const planner = new StubPlanner([{ name: 'S1', description: 'd', features: [] }]);
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });
    const result = await uc.execute({ projectId: project.id, phaseId: phase.id });

    expect(result.harness.toProps().projectPath).toBe('/Users/me/my-repo');
  });

  it('creates harness project without projectPath when pipeline project has none', async () => {
    const project = PipelineProject.create({ userId: 'u1', name: 'P' });
    await projectRepo.save(project);
    const phase = await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'implementation' }).start()
    );

    const planner = new StubPlanner([{ name: 'S1', description: 'd', features: [] }]);
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });
    const result = await uc.execute({ projectId: project.id, phaseId: phase.id });

    expect(result.harness.toProps().projectPath).toBeUndefined();
  });

  it('throws NotFoundError for unknown project', async () => {
    const planner = new StubPlanner([]);
    const uc = makeUc({ projectRepo, phaseRepo, harnessProjectRepo, harnessSprintRepo, planner });
    await expect(uc.execute({ projectId: 'ghost', phaseId: 'p1' })).rejects.toThrow(
      /PipelineProject/
    );
  });
});
