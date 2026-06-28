import { randomUUID } from 'node:crypto';

export type SecretCategory = 'ai' | 'integration' | 'oauth' | 'other';

export interface SecretProps {
  id: string;
  userId: string;
  key: string;
  displayName: string;
  description: string | undefined;
  category: SecretCategory;
  lastAccessed: Date | undefined;
  lastRotated: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type SecretCreateInput = {
  userId: string;
  key: string;
  displayName: string;
  category: SecretCategory;
  description?: string;
};

export type SecretUpdateInput = Partial<
  Pick<SecretProps, 'displayName' | 'description' | 'category'>
>;

export class Secret {
  readonly id: string;
  readonly userId: string;
  readonly key: string;
  readonly displayName: string;
  readonly description: string | undefined;
  readonly category: SecretCategory;
  readonly lastAccessed: Date | undefined;
  readonly lastRotated: Date | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: SecretProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.key = props.key;
    this.displayName = props.displayName;
    this.description = props.description;
    this.category = props.category;
    this.lastAccessed = props.lastAccessed;
    this.lastRotated = props.lastRotated;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: SecretCreateInput): Secret {
    const now = new Date();
    return new Secret({
      id: randomUUID(),
      userId: input.userId,
      key: input.key,
      displayName: input.displayName,
      description: input.description,
      category: input.category,
      lastAccessed: undefined,
      lastRotated: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: SecretProps): Secret {
    return new Secret(props);
  }

  withAccessed(): Secret {
    return new Secret({ ...this.toProps(), lastAccessed: new Date(), updatedAt: new Date() });
  }

  withRotated(): Secret {
    return new Secret({ ...this.toProps(), lastRotated: new Date(), updatedAt: new Date() });
  }

  withUpdate(input: SecretUpdateInput): Secret {
    return new Secret({
      ...this.toProps(),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      updatedAt: new Date(),
    });
  }

  toProps(): SecretProps {
    return {
      id: this.id,
      userId: this.userId,
      key: this.key,
      displayName: this.displayName,
      description: this.description,
      category: this.category,
      lastAccessed: this.lastAccessed,
      lastRotated: this.lastRotated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export interface SecretRepo {
  findAll(userId: string): Promise<Secret[]>;
  findByKey(key: string): Promise<Secret | null>;
  save(secret: Secret): Promise<Secret>;
  delete(key: string): Promise<void>;
}
