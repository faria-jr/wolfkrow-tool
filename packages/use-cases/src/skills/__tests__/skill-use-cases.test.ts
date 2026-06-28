import {
  Skill,
  ValidationError,
  NotFoundError,
  Agent,
  type SkillProps,
  type SkillCreateInput,
} from '@wolfkrow/domain';
import type { SkillRepo, AgentRepo } from '@wolfkrow/domain';
import { describe, expect, it, beforeEach } from 'vitest';

import { AttachSkillToAgentUseCase } from '../attach-skill-to-agent';
import { CreateSkillUseCase } from '../create-skill';
import { DeleteSkillUseCase } from '../delete-skill';
import { DetachSkillFromAgentUseCase } from '../detach-skill-from-agent';
import { GetSkillUseCase } from '../get-skill';
import { ListSkillsUseCase } from '../list-skills';
import { UpdateSkillUseCase } from '../update-skill';

class InMemorySkillRepo implements SkillRepo {
  private store = new Map<string, Skill>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string) {
    return [...this.store.values()].filter((s) => s.userId === userId);
  }
  async findBuiltIn() {
    return [...this.store.values()].filter((s) => s.isBuiltIn);
  }
  async findByName(userId: string, name: string) {
    return [...this.store.values()].find((s) => s.userId === userId && s.name === name) ?? null;
  }
  async save(skill: Skill) {
    this.store.set(skill.id, skill);
    return skill;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
  seed(skills: Skill[]) {
    for (const s of skills) this.store.set(s.id, s);
  }
}

class InMemoryAgentRepo implements AgentRepo {
  private store = new Map<string, Agent>();
  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByUserId(userId: string) {
    return [...this.store.values()].filter((a) => a.userId === userId);
  }
  async findActiveByUserId(userId: string) {
    return [...this.store.values()].filter((a) => a.userId === userId && a.isActive);
  }
  async save(agent: Agent) {
    this.store.set(agent.id, agent);
    return agent;
  }
  async delete(id: string) {
    this.store.delete(id);
  }
  seed(agents: Agent[]) {
    for (const a of agents) this.store.set(a.id, a);
  }
}

const USER = 'user-1';

function makeSkill(overrides: Partial<SkillProps> = {}) {
  return Skill.create({
    userId: USER,
    name: 'pdf',
    description: 'PDF proc',
    content: '# PDF',
    tags: ['docs'],
    isBuiltIn: false,
    ...overrides,
  } as SkillCreateInput);
}

function makeAgent() {
  return Agent.create({
    userId: USER,
    name: 'my-agent',
    description: undefined,
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    thinking: false,
    thinkingBudget: undefined,
    maxTurns: 80,
    allowedTools: [],
    mcpServers: [],
    isActive: true,
    skills: [],
    runtime: 'cloud',
    provider: undefined,
    squad: undefined,
    systemPrompt: undefined,
  });
}

describe('CreateSkillUseCase', () => {
  let repo: InMemorySkillRepo;
  let useCase: CreateSkillUseCase;

  beforeEach(() => {
    repo = new InMemorySkillRepo();
    useCase = new CreateSkillUseCase(repo);
  });

  it('creates and persists skill', async () => {
    const { skill } = await useCase.execute({
      userId: USER,
      name: 'pdf',
      description: 'PDF',
      content: '# PDF',
      tags: [],
      isBuiltIn: false,
    });
    expect(skill.name).toBe('pdf');
    expect(await repo.findById(skill.id)).not.toBeNull();
  });

  it('throws ValidationError for empty name', async () => {
    await expect(
      useCase.execute({
        userId: USER,
        name: '',
        description: 'x',
        content: 'y',
        tags: [],
        isBuiltIn: false,
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe('UpdateSkillUseCase', () => {
  let repo: InMemorySkillRepo;
  let useCase: UpdateSkillUseCase;
  let skill: Skill;

  beforeEach(async () => {
    repo = new InMemorySkillRepo();
    useCase = new UpdateSkillUseCase(repo);
    skill = await repo.save(makeSkill());
  });

  it('patches name', async () => {
    const { skill: updated } = await useCase.execute({ id: skill.id, name: 'new-name' });
    expect(updated.name).toBe('new-name');
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(useCase.execute({ id: 'nope', name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for empty name', async () => {
    await expect(useCase.execute({ id: skill.id, name: '' })).rejects.toThrow(ValidationError);
  });
});

describe('DeleteSkillUseCase', () => {
  let repo: InMemorySkillRepo;
  let useCase: DeleteSkillUseCase;
  let skill: Skill;

  beforeEach(async () => {
    repo = new InMemorySkillRepo();
    useCase = new DeleteSkillUseCase(repo);
    skill = await repo.save(makeSkill());
  });

  it('removes skill from repo', async () => {
    await useCase.execute({ id: skill.id });
    expect(await repo.findById(skill.id)).toBeNull();
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(useCase.execute({ id: 'nope' })).rejects.toThrow(NotFoundError);
  });
});

describe('ListSkillsUseCase', () => {
  let repo: InMemorySkillRepo;
  let useCase: ListSkillsUseCase;

  beforeEach(async () => {
    repo = new InMemorySkillRepo();
    useCase = new ListSkillsUseCase(repo);
    await repo.save(makeSkill({ name: 'skill-a' }));
    await repo.save(makeSkill({ name: 'skill-b' }));
    await repo.save(makeSkill({ name: 'other-user-skill', userId: 'user-2' }));
    await repo.save(
      Skill.create({
        userId: USER,
        name: 'builtin',
        description: 'x',
        content: 'y',
        tags: [],
        isBuiltIn: true,
      })
    );
  });

  it('lists all skills for user', async () => {
    const { skills } = await useCase.execute({ userId: USER });
    expect(skills).toHaveLength(3);
  });

  it('lists only builtin skills', async () => {
    const { skills } = await useCase.execute({ userId: USER, builtinOnly: true });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.isBuiltIn).toBe(true);
  });

  it('returns empty for unknown user', async () => {
    const { skills } = await useCase.execute({ userId: 'unknown' });
    expect(skills).toHaveLength(0);
  });
});

describe('GetSkillUseCase', () => {
  let repo: InMemorySkillRepo;
  let useCase: GetSkillUseCase;

  beforeEach(async () => {
    repo = new InMemorySkillRepo();
    useCase = new GetSkillUseCase(repo);
    await repo.save(makeSkill({ name: 'skill-a' }));
  });

  it('returns a skill when it exists', async () => {
    const [skill] = await repo.findByUserId(USER);
    const out = await useCase.execute({ id: skill!.id, userId: USER });
    expect(out.skill.name).toBe('skill-a');
  });

  it('throws NotFoundError for an unknown skill', async () => {
    await expect(useCase.execute({ id: 'missing', userId: USER })).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for a skill owned by another user', async () => {
    const other = await repo.save(makeSkill({ name: 'private-skill', userId: 'user-2' }));
    await expect(useCase.execute({ id: other.id, userId: USER })).rejects.toThrow(NotFoundError);
  });
});

describe('AttachSkillToAgentUseCase', () => {
  let skillRepo: InMemorySkillRepo;
  let agentRepo: InMemoryAgentRepo;
  let useCase: AttachSkillToAgentUseCase;
  let skill: Skill;
  let agent: Agent;

  beforeEach(async () => {
    skillRepo = new InMemorySkillRepo();
    agentRepo = new InMemoryAgentRepo();
    useCase = new AttachSkillToAgentUseCase(skillRepo, agentRepo);
    skill = await skillRepo.save(makeSkill());
    agent = await agentRepo.save(makeAgent());
  });

  it('attaches skill to agent', async () => {
    const { agent: updated } = await useCase.execute({ skillId: skill.id, agentId: agent.id });
    expect(updated.skills).toContain(skill.id);
  });

  it('is idempotent — no duplicate', async () => {
    await useCase.execute({ skillId: skill.id, agentId: agent.id });
    const { agent: updated } = await useCase.execute({ skillId: skill.id, agentId: agent.id });
    expect(updated.skills.filter((s) => s === skill.id)).toHaveLength(1);
  });

  it('throws NotFoundError for unknown skill', async () => {
    await expect(useCase.execute({ skillId: 'nope', agentId: agent.id })).rejects.toThrow(
      NotFoundError
    );
  });

  it('throws NotFoundError for unknown agent', async () => {
    await expect(useCase.execute({ skillId: skill.id, agentId: 'nope' })).rejects.toThrow(
      NotFoundError
    );
  });
});

describe('DetachSkillFromAgentUseCase', () => {
  let skillRepo: InMemorySkillRepo;
  let agentRepo: InMemoryAgentRepo;
  let useCase: DetachSkillFromAgentUseCase;
  let skill: Skill;
  let agent: Agent;

  beforeEach(async () => {
    skillRepo = new InMemorySkillRepo();
    agentRepo = new InMemoryAgentRepo();
    useCase = new DetachSkillFromAgentUseCase(agentRepo);
    skill = await skillRepo.save(makeSkill());
    agent = await agentRepo.save(makeAgent());
  });

  it('detaches skill from agent', async () => {
    const withSkill = agent.update({ skills: [skill.id] });
    await agentRepo.save(withSkill);
    const { agent: updated } = await useCase.execute({ skillId: skill.id, agentId: agent.id });
    expect(updated.skills).not.toContain(skill.id);
  });

  it('is idempotent when skill not attached', async () => {
    const { agent: updated } = await useCase.execute({ skillId: skill.id, agentId: agent.id });
    expect(updated.skills).not.toContain(skill.id);
  });

  it('throws NotFoundError for unknown agent', async () => {
    await expect(useCase.execute({ skillId: skill.id, agentId: 'nope' })).rejects.toThrow(
      NotFoundError
    );
  });
});
