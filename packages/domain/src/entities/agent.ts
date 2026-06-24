import { randomUUID } from 'node:crypto';

import { ValidationError } from '../errors/domain-error';

export type Runtime = 'cloud' | 'local' | 'codex' | 'external' | 'claude-compat';
export type Squad = 'harness' | 'workflow' | 'enrich' | 'custom';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export interface AgentProps {
  id: string;
  userId: string;
  name: string;
  description: string | undefined;
  model: string;
  effort: Effort;
  thinking: boolean;
  thinkingBudget: number | undefined;
  maxTurns: number;
  allowedTools: string[];
  mcpServers: string[];
  isActive: boolean;
  skills: string[];
  runtime: Runtime;
  provider: string | undefined;
  squad: Squad | undefined;
  systemPrompt: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentCreateInput = Omit<AgentProps, 'id' | 'createdAt' | 'updatedAt'>;
export type AgentUpdateInput = Partial<Omit<AgentCreateInput, 'userId'>>;

export interface PromptContext {
  extraInstructions?: string;
}

function assertName(name: string): void {
  if (!name.trim()) throw new ValidationError('name', 'Agent name is required');
}

function assertMaxTurns(maxTurns: number): void {
  if (maxTurns < 1) throw new ValidationError('maxTurns', 'maxTurns must be >= 1');
}

export class Agent {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly model: string;
  readonly effort: Effort;
  readonly thinking: boolean;
  readonly thinkingBudget: number | undefined;
  readonly maxTurns: number;
  readonly allowedTools: readonly string[];
  readonly mcpServers: readonly string[];
  readonly isActive: boolean;
  readonly skills: readonly string[];
  readonly runtime: Runtime;
  readonly provider: string | undefined;
  readonly squad: Squad | undefined;
  readonly systemPrompt: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: AgentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.model = props.model;
    this.effort = props.effort;
    this.thinking = props.thinking;
    this.thinkingBudget = props.thinkingBudget;
    this.maxTurns = props.maxTurns;
    this.allowedTools = props.allowedTools;
    this.mcpServers = props.mcpServers;
    this.isActive = props.isActive;
    this.skills = props.skills;
    this.runtime = props.runtime;
    this.provider = props.provider;
    this.squad = props.squad;
    this.systemPrompt = props.systemPrompt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: AgentCreateInput): Agent {
    assertName(input.name);
    assertMaxTurns(input.maxTurns);
    const now = new Date();
    return new Agent({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  static fromProps(props: AgentProps): Agent {
    return new Agent(props);
  }

  toProps(): AgentProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      model: this.model,
      effort: this.effort,
      thinking: this.thinking,
      thinkingBudget: this.thinkingBudget,
      maxTurns: this.maxTurns,
      allowedTools: [...this.allowedTools],
      mcpServers: [...this.mcpServers],
      isActive: this.isActive,
      skills: [...this.skills],
      runtime: this.runtime,
      provider: this.provider,
      squad: this.squad,
      systemPrompt: this.systemPrompt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  duplicate(newName: string): Agent {
    assertName(newName);
    return Agent.create({ ...this.toProps(), name: newName });
  }

  buildPrompt(_context: PromptContext): string {
    const parts: string[] = [];
    if (this.systemPrompt) parts.push(this.systemPrompt);
    if (this.skills.length > 0) parts.push(`Skills: ${this.skills.join(', ')}.`);
    return parts.join('\n');
  }

  activate(): Agent {
    return Agent.fromProps({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  deactivate(): Agent {
    return Agent.fromProps({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  update(patch: AgentUpdateInput): Agent {
    if (patch.name !== undefined) assertName(patch.name);
    if (patch.maxTurns !== undefined) assertMaxTurns(patch.maxTurns);
    return Agent.fromProps({ ...this.toProps(), ...patch, updatedAt: new Date() });
  }
}
