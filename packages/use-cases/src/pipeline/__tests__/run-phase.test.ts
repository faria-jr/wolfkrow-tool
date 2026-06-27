import { NotFoundError, PipelinePhase, PipelineProject } from '@wolfkrow/domain';
import type { AIStreamPort, ArtifactWriter, PipelineMessage, PipelineMessageRepo, PipelinePhaseRepo, PipelineProjectRepo } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import { RunPhaseUseCase } from '../run-phase';

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

function makeAI(content = 'AI output', inputTokens = 10, outputTokens = 5): AIStreamPort {
  return {
    query: vi.fn(),
    complete: vi.fn().mockResolvedValue({ content, usage: { inputTokens, outputTokens }, stopReason: 'end_turn' }),
  };
}

function makeProject(stage: PipelineProject['currentStage'] = 'discovery') {
  const p = PipelineProject.create({ userId: 'u1', name: 'Test Pipeline' });
  return p.withStage(stage);
}

function makePhase(projectId: string, stage: PipelinePhase['stage'] = 'discovery') {
  return PipelinePhase.create({ projectId, stage }).start();
}

class InMemoryMessageRepo implements PipelineMessageRepo {
  readonly store = new Map<string, PipelineMessage>();
  async save(m: PipelineMessage) { this.store.set(m.id, m); return m; }
  async saveMany(msgs: PipelineMessage[]) { for (const m of msgs) this.store.set(m.id, m); }
  async findByPhaseId(pid: string) { return [...this.store.values()].filter((m) => m.phaseId === pid); }
  async findByProjectId(pid: string) { return [...this.store.values()].filter((m) => m.projectId === pid); }
}

function makeArtifactWriter(): ArtifactWriter & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    async write(key: string, content: string) {
      written.set(key, content);
      return `/artifacts/${key}.md`;
    },
  };
}

describe('RunPhaseUseCase', () => {
  it('runs discovery phase and returns AI output', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI('discovery notes output');

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const uc = new RunPhaseUseCase(projectRepo, phaseRepo, ai);
    const result = await uc.execute({ projectId: project.id, phaseId: phase.id });

    expect(result.output).toBe('discovery notes output');
    expect(ai.complete).toHaveBeenCalledOnce();
  });

  it('uses discovery system prompt for discovery stage', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    const callArgs = vi.mocked(ai.complete).mock.calls[0]?.[0];
    expect(callArgs?.system).toMatch(/discovery|product/i);
  });

  it('uses spec_build system prompt for spec_build stage', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const project = makeProject('spec_build');
    const phase = makePhase(project.id, 'spec_build');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    const callArgs = vi.mocked(ai.complete).mock.calls[0]?.[0];
    expect(callArgs?.system).toMatch(/spec|architect/i);
  });

  it('completes phase with total token count', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI('output', 20, 30);

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    expect(result.tokens).toBe(50);
    expect(result.phase.status).toBe('completed');
    expect(result.phase.metrics.tokens).toBe(50);
  });

  it('records computed USD cost in phase metrics', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI('output', 1000, 500);

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    expect(result.phase.metrics.cost).toBeGreaterThan(0);
  });

  it('advances project stage from discovery to spec_build', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    expect(result.project.currentStage).toBe('spec_build');
  });

  it('accepts custom userPrompt that is passed to AI', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id, userPrompt: 'custom user prompt here',
    });

    const callArgs = vi.mocked(ai.complete).mock.calls[0]?.[0];
    const userMsg = callArgs?.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toBe('custom user prompt here');
  });

  it('throws NotFoundError when project not found', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const phase = makePhase('proj-missing', 'discovery');
    await phaseRepo.save(phase);

    await expect(
      new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
        projectId: 'proj-missing', phaseId: phase.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when phase not found', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI();

    const project = makeProject('discovery');
    await projectRepo.save(project);

    await expect(
      new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
        projectId: project.id, phaseId: 'phase-missing',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('implementation stage completes phase and moves project to completed', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const ai = makeAI('harness triggered');

    const project = makeProject('implementation');
    const phase = makePhase(project.id, 'implementation');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, ai).execute({
      projectId: project.id, phaseId: phase.id,
    });

    expect(result.phase.status).toBe('completed');
    expect(result.project.currentStage).toBe('completed');
  });

  it('persists user and assistant messages when messageRepo provided (T26)', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const messageRepo = new InMemoryMessageRepo();
    const ai = makeAI('discovery output');

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai, { messageRepo }).execute({
      projectId: project.id, phaseId: phase.id, userPrompt: 'analyze this',
    });

    const msgs = await messageRepo.findByPhaseId(phase.id);
    expect(msgs).toHaveLength(2);
    expect(msgs.some((m) => m.role === 'user' && m.content === 'analyze this')).toBe(true);
    expect(msgs.some((m) => m.role === 'assistant' && m.content === 'discovery output')).toBe(true);
  });

  it('writes the assistant output as an artifact and sets artifactPath (T26)', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const messageRepo = new InMemoryMessageRepo();
    const writer = makeArtifactWriter();
    const ai = makeAI('spec artifact body');

    const project = makeProject('spec_build');
    const phase = makePhase(project.id, 'spec_build');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    const result = await new RunPhaseUseCase(projectRepo, phaseRepo, ai, { messageRepo, artifactWriter: writer }).execute({
      projectId: project.id, phaseId: phase.id,
    });

    expect(result.phase.artifactPath).toMatch(/\/artifacts\//);
    expect([...writer.written.values()]).toContain('spec artifact body');
  });

  it('skips assistant message and artifact when AI output is empty (consistency fix)', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const messageRepo = new InMemoryMessageRepo();
    const writer = makeArtifactWriter();
    const ai = makeAI('');

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai, { messageRepo, artifactWriter: writer }).execute({
      projectId: project.id, phaseId: phase.id, userPrompt: 'go',
    });

    const msgs = await messageRepo.findByPhaseId(phase.id);
    expect(msgs.filter((m) => m.role === 'assistant')).toHaveLength(0);
    expect(writer.written.size).toBe(0);
  });

  it('persists user+assistant messages atomically via saveMany', async () => {
    const projectRepo = new InMemoryProjectRepo();
    const phaseRepo = new InMemoryPhaseRepo();
    const messageRepo = new InMemoryMessageRepo();
    const saveMany = vi.spyOn(messageRepo, 'saveMany');
    const ai = makeAI('output');

    const project = makeProject('discovery');
    const phase = makePhase(project.id, 'discovery');
    await projectRepo.save(project);
    await phaseRepo.save(phase);

    await new RunPhaseUseCase(projectRepo, phaseRepo, ai, { messageRepo }).execute({
      projectId: project.id, phaseId: phase.id, userPrompt: 'go',
    });

    expect(saveMany).toHaveBeenCalledTimes(1);
    const batch = saveMany.mock.calls[0]?.[0] ?? [];
    expect(batch).toHaveLength(2);
    expect(batch.map((m) => m.role).sort()).toEqual(['assistant', 'user']);
  });
});
