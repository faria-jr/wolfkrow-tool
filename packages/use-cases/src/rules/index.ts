import { GlobalRule } from '@wolfkrow/domain';
import type { GlobalRuleCreateInput, GlobalRuleRepo, RuleKind } from '@wolfkrow/domain';

const KIND_ORDER: Record<RuleKind, number> = { behavior: 0, soul: 1, user: 2, custom: 3 };

// --- List Rules ---

export class ListRulesUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(userId: string): Promise<GlobalRule[]> {
    const rules = await this.repo.findAll(userId);
    return rules.sort((a, b) => {
      const ko = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      return ko !== 0 ? ko : a.sortOrder - b.sortOrder;
    });
  }
}

// --- Create Rule ---

export class CreateRuleUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(input: GlobalRuleCreateInput): Promise<GlobalRule> {
    const rule = GlobalRule.create(input);
    return this.repo.save(rule);
  }
}

// --- Update Rule ---

export interface UpdateRuleInput {
  id: string;
  title?: string;
  body?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export class UpdateRuleUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(input: UpdateRuleInput): Promise<GlobalRule> {
    const rule = await this.repo.findById(input.id);
    if (!rule) throw new Error(`Rule ${input.id} not found`);
    const updated = rule.withUpdate({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    });
    return this.repo.save(updated);
  }
}

// --- Toggle Rule ---

export class ToggleRuleUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(id: string): Promise<GlobalRule> {
    const rule = await this.repo.findById(id);
    if (!rule) throw new Error(`Rule ${id} not found`);
    return this.repo.save(rule.toggle());
  }
}

// --- Delete Rule ---

export class DeleteRuleUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}

// --- Build System Prompt ---

export interface BuildSystemPromptInput {
  userId: string;
  agentSystemPrompt?: string;
  skillDescriptions?: string[];
}

export class BuildSystemPromptUseCase {
  constructor(private readonly repo: GlobalRuleRepo) {}

  async execute(input: BuildSystemPromptInput): Promise<string> {
    const rules = await this.repo.findAll(input.userId);
    const enabled = rules
      .filter((r) => r.enabled)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sortOrder - b.sortOrder);

    const parts: string[] = [];

    if (input.agentSystemPrompt) parts.push(input.agentSystemPrompt);

    for (const rule of enabled) {
      parts.push(rule.toPromptSection());
    }

    if (input.skillDescriptions?.length) {
      parts.push('## Available Skills\n' + input.skillDescriptions.join('\n'));
    }

    return parts.join('\n\n');
  }
}
