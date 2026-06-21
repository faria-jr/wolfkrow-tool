import type { PipelinePhaseRepo, PipelineProjectRepo } from '@wolfkrow/domain';
import { PipelinePhase, PipelineProject, NotFoundError } from '@wolfkrow/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovePipelinePhaseUseCase,
  CreatePipelineProjectUseCase,
  DeletePipelineProjectUseCase,
  GetPipelineProjectUseCase,
  ListPipelineProjectsUseCase,
  StartPhaseUseCase,
  CompletePhaseUseCase,
} from '../index';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class InMemoryProjectRepo implements PipelineProjectRepo {
  readonly store = new Map<string, PipelineProject>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByUserId(u: string) { return [...this.store.values()].filter((p) => p.userId === u); }
  async save(p: PipelineProject) { this.store.set(p.id, p); return p; }
  async delete(id: string) { this.store.delete(id); }
}

class InMemoryPhaseRepo implements PipelinePhaseRepo {
  readonly store = new Map<string, PipelinePhase>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByProjectId(pid: string) { return [...this.store.values()].filter((p) => p.projectId === pid); }
  async save(p: PipelinePhase) { this.store.set(p.id, p); return p; }
}

// ── CreatePipelineProjectUseCase ──────────────────────────────────────────────

describe('CreatePipelineProjectUseCase', () => {
  it('creates project in discovery stage, running status', async () => {
    const repo = new InMemoryProjectRepo();
    const uc = new CreatePipelineProjectUseCase(repo);
    const { project } = await uc.execute({ userId: 'u1', name: 'MyPipeline' });
    expect(project.currentStage).toBe('discovery');
    expect(project.status).toBe('running');
    expect(project.name).toBe('MyPipeline');
  });
});

// ── GetPipelineProjectUseCase ─────────────────────────────────────────────────

describe('GetPipelineProjectUseCase', () => {
  let repo: InMemoryProjectRepo;
  let projectId: string;

  beforeEach(async () => {
    repo = new InMemoryProjectRepo();
    const p = PipelineProject.create({ userId: 'u1', name: 'P' });
    await repo.save(p);
    projectId = p.id;
  });

  it('returns existing project', async () => {
    const { project } = await new GetPipelineProjectUseCase(repo).execute({ projectId });
    expect(project.id).toBe(projectId);
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(new GetPipelineProjectUseCase(repo).execute({ projectId: 'bad' })).rejects.toThrow(NotFoundError);
  });
});

// ── ListPipelineProjectsUseCase ───────────────────────────────────────────────

describe('ListPipelineProjectsUseCase', () => {
  it('lists only projects for userId', async () => {
    const repo = new InMemoryProjectRepo();
    await repo.save(PipelineProject.create({ userId: 'u1', name: 'A' }));
    await repo.save(PipelineProject.create({ userId: 'u2', name: 'B' }));
    const { projects } = await new ListPipelineProjectsUseCase(repo).execute({ userId: 'u1' });
    expect(projects).toHaveLength(1);
  });
});

// ── DeletePipelineProjectUseCase ──────────────────────────────────────────────

describe('DeletePipelineProjectUseCase', () => {
  it('deletes project', async () => {
    const repo = new InMemoryProjectRepo();
    const p = PipelineProject.create({ userId: 'u1', name: 'X' });
    await repo.save(p);
    await new DeletePipelineProjectUseCase(repo).execute({ projectId: p.id, userId: 'u1' });
    expect(await repo.findById(p.id)).toBeNull();
  });

  it('throws NotFoundError for wrong userId', async () => {
    const repo = new InMemoryProjectRepo();
    const p = PipelineProject.create({ userId: 'u1', name: 'X' });
    await repo.save(p);
    await expect(new DeletePipelineProjectUseCase(repo).execute({ projectId: p.id, userId: 'u2' })).rejects.toThrow(NotFoundError);
  });
});

// ── StartPhaseUseCase ─────────────────────────────────────────────────────────

describe('StartPhaseUseCase', () => {
  it('creates phase in in_progress status', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const p = PipelineProject.create({ userId: 'u1', name: 'P' });
    await projectRepo.save(p);

    const { phase } = await new StartPhaseUseCase(projectRepo, phaseRepo).execute({ projectId: p.id, stage: 'discovery' });
    expect(phase.status).toBe('in_progress');
    expect(phase.stage).toBe('discovery');
    expect(phase.startedAt).toBeDefined();
  });
});

// ── CompletePhaseUseCase ──────────────────────────────────────────────────────

describe('CompletePhaseUseCase', () => {
  it('marks phase completed and advances project stage', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const p = PipelineProject.create({ userId: 'u1', name: 'P' });
    await projectRepo.save(p);
    const phase = await phaseRepo.save(PipelinePhase.create({ projectId: p.id, stage: 'discovery' }).start());

    const { phase: completed, project } = await new CompletePhaseUseCase(projectRepo, phaseRepo).execute({
      phaseId: phase.id, projectId: p.id, artifactPath: '/tmp/notes.md', tokens: 500,
    });
    expect(completed.status).toBe('completed');
    expect(project.currentStage).toBe('spec_build');
  });
});

// ── ApprovePipelinePhaseUseCase ───────────────────────────────────────────────

describe('ApprovePipelinePhaseUseCase', () => {
  it('approves approval phase and moves to implementation', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    let p = PipelineProject.create({ userId: 'u1', name: 'P' });
    p = p.withStage('approval', { status: 'awaiting_approval' });
    await projectRepo.save(p);
    const phase = await phaseRepo.save(PipelinePhase.create({ projectId: p.id, stage: 'approval' }).start().awaitUser());

    const { project } = await new ApprovePipelinePhaseUseCase(projectRepo, phaseRepo).execute({
      projectId: p.id, phaseId: phase.id, approved: true, notes: 'Looks good',
    });
    expect(project.currentStage).toBe('implementation');
    expect(project.status).toBe('running');
  });

  it('rejects approval phase → project paused', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    let p = PipelineProject.create({ userId: 'u1', name: 'P' });
    p = p.withStage('approval', { status: 'awaiting_approval' });
    await projectRepo.save(p);
    const phase = await phaseRepo.save(PipelinePhase.create({ projectId: p.id, stage: 'approval' }).start().awaitUser());

    const { project } = await new ApprovePipelinePhaseUseCase(projectRepo, phaseRepo).execute({
      projectId: p.id, phaseId: phase.id, approved: false, notes: 'Need changes',
    });
    expect(project.status).toBe('paused');
  });
});
