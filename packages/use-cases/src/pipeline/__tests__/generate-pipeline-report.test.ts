import { NotFoundError, PipelineMessage, PipelinePhase, PipelineProject } from '@wolfkrow/domain';
import type { PipelineMessageRepo, PipelinePhaseRepo, PipelineProjectRepo } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { GeneratePipelineReportUseCase } from '../generate-pipeline-report';

class InMemoryProjectRepo implements PipelineProjectRepo {
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

class InMemoryPhaseRepo implements PipelinePhaseRepo {
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

class InMemoryMessageRepo implements PipelineMessageRepo {
  readonly store = new Map<string, PipelineMessage>();
  async save(m: PipelineMessage) {
    this.store.set(m.id, m);
    return m;
  }
  async saveMany(msgs: PipelineMessage[]) {
    for (const m of msgs) this.store.set(m.id, m);
  }
  async findByPhaseId(pid: string) {
    return [...this.store.values()].filter((m) => m.phaseId === pid);
  }
  async findByProjectId(pid: string) {
    return [...this.store.values()].filter((m) => m.projectId === pid);
  }
}

describe('GeneratePipelineReportUseCase', () => {
  it('throws NotFoundError when project does not exist', async () => {
    const uc = new GeneratePipelineReportUseCase(
      new InMemoryProjectRepo(),
      new InMemoryPhaseRepo()
    );
    await expect(uc.execute({ projectId: 'missing' })).rejects.toThrow(NotFoundError);
  });

  it('renders project header + each phase with its assistant output', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const messageRepo = new InMemoryMessageRepo();

    const project = PipelineProject.create({
      userId: 'u1',
      name: 'My Pipeline',
      description: 'desc',
    });
    await projectRepo.save(project);

    const discovery = PipelinePhase.create({ projectId: project.id, stage: 'discovery' })
      .start()
      .complete('/a/discovery.md', 100);
    const spec = PipelinePhase.create({ projectId: project.id, stage: 'spec_build' })
      .start()
      .complete('/a/spec.md', 200);
    await phaseRepo.save(discovery);
    await phaseRepo.save(spec);

    await messageRepo.saveMany([
      PipelineMessage.create({
        projectId: project.id,
        phaseId: discovery.id,
        role: 'assistant',
        content: 'Discovery notes here',
      }),
      PipelineMessage.create({
        projectId: project.id,
        phaseId: spec.id,
        role: 'assistant',
        content: 'Spec body here',
      }),
    ]);

    const uc = new GeneratePipelineReportUseCase(projectRepo, phaseRepo, messageRepo);
    const { report } = await uc.execute({ projectId: project.id });

    expect(report).toContain('# My Pipeline');
    expect(report).toContain('desc');
    expect(report).toContain('discovery — completed');
    expect(report).toContain('Discovery notes here');
    expect(report).toContain('spec_build — completed');
    expect(report).toContain('Spec body here');
    // discovery should appear before spec_build regardless of insertion order
    expect(report.indexOf('discovery')).toBeLessThan(report.indexOf('spec_build'));
  });

  it('reports (no output recorded) for a phase with no assistant message', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();

    const project = PipelineProject.create({ userId: 'u1', name: 'P' });
    await projectRepo.save(project);
    await phaseRepo.save(
      PipelinePhase.create({ projectId: project.id, stage: 'discovery' }).start()
    );

    const uc = new GeneratePipelineReportUseCase(projectRepo, phaseRepo);
    const { report } = await uc.execute({ projectId: project.id });

    expect(report).toContain('no output recorded');
  });
});
