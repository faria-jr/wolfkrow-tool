import { randomUUID } from 'node:crypto';

export type TaskStatus = 'active' | 'paused';

export interface ScheduledTaskProps {
  id: string;
  userId: string;
  name: string;
  description: string | undefined;
  cronExpression: string;
  timezone: string;
  prompt: string;
  agentId: string | undefined;
  enabled: boolean;
  lastRunAt: Date | undefined;
  nextRunAt: Date | undefined;
  config: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduledTaskCreateInput = Omit<ScheduledTaskProps, 'id' | 'createdAt' | 'updatedAt'>;

export class ScheduledTask {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly cronExpression: string;
  readonly timezone: string;
  readonly prompt: string;
  readonly agentId: string | undefined;
  readonly enabled: boolean;
  readonly lastRunAt: Date | undefined;
  readonly nextRunAt: Date | undefined;
  readonly config: Record<string, unknown>;
  readonly tags: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ScheduledTaskProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.cronExpression = props.cronExpression;
    this.timezone = props.timezone;
    this.prompt = props.prompt;
    this.agentId = props.agentId;
    this.enabled = props.enabled;
    this.lastRunAt = props.lastRunAt;
    this.nextRunAt = props.nextRunAt;
    this.config = props.config;
    this.tags = props.tags;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: ScheduledTaskCreateInput): ScheduledTask {
    const now = new Date();
    return new ScheduledTask({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  static fromProps(props: ScheduledTaskProps): ScheduledTask {
    return new ScheduledTask(props);
  }

  toProps(): ScheduledTaskProps {
    return {
      id: this.id, userId: this.userId, name: this.name, description: this.description,
      cronExpression: this.cronExpression, timezone: this.timezone, prompt: this.prompt,
      agentId: this.agentId, enabled: this.enabled, lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt, config: this.config, tags: this.tags,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
    };
  }

  withUpdate(patch: Partial<Pick<ScheduledTaskProps, 'name' | 'description' | 'cronExpression' | 'prompt' | 'agentId' | 'enabled' | 'tags' | 'config'>>): ScheduledTask {
    return ScheduledTask.fromProps({ ...this.toProps(), ...patch, updatedAt: new Date() });
  }

  withNextRun(nextRunAt: Date, lastRunAt: Date): ScheduledTask {
    return ScheduledTask.fromProps({ ...this.toProps(), nextRunAt, lastRunAt, updatedAt: new Date() });
  }
}
