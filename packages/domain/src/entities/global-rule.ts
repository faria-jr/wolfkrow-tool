import { randomUUID } from 'node:crypto';

export type RuleKind = 'behavior' | 'soul' | 'user' | 'custom';

export interface GlobalRuleProps {
  id: string;
  userId: string;
  kind: RuleKind;
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type GlobalRuleCreateInput = {
  userId: string;
  kind: RuleKind;
  title: string;
  body: string;
  enabled?: boolean;
  sortOrder?: number;
};

export class GlobalRule {
  readonly id: string;
  readonly userId: string;
  readonly kind: RuleKind;
  readonly title: string;
  readonly body: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: GlobalRuleProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.kind = props.kind;
    this.title = props.title;
    this.body = props.body;
    this.enabled = props.enabled;
    this.sortOrder = props.sortOrder;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: GlobalRuleCreateInput): GlobalRule {
    const now = new Date();
    return new GlobalRule({
      id: randomUUID(),
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: GlobalRuleProps): GlobalRule {
    return new GlobalRule(props);
  }

  toggle(): GlobalRule {
    return new GlobalRule({ ...this.toProps(), enabled: !this.enabled, updatedAt: new Date() });
  }

  withUpdate(
    patch: Partial<Pick<GlobalRuleProps, 'title' | 'body' | 'enabled' | 'sortOrder'>>
  ): GlobalRule {
    return new GlobalRule({ ...this.toProps(), ...patch, updatedAt: new Date() });
  }

  toPromptSection(): string {
    return `## ${this.title}\n${this.body}`;
  }

  toProps(): GlobalRuleProps {
    return {
      id: this.id,
      userId: this.userId,
      kind: this.kind,
      title: this.title,
      body: this.body,
      enabled: this.enabled,
      sortOrder: this.sortOrder,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export interface GlobalRuleRepo {
  findAll(userId: string): Promise<GlobalRule[]>;
  findById(id: string): Promise<GlobalRule | null>;
  save(rule: GlobalRule): Promise<GlobalRule>;
  delete(id: string): Promise<void>;
}
