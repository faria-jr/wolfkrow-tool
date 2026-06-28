import { randomUUID } from 'node:crypto';

import { ValidationError } from '../errors/domain-error';

export interface SkillProps {
  id: string;
  userId: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  version: string;
  author: string | undefined;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillCreateInput = Omit<
  SkillProps,
  'id' | 'version' | 'author' | 'createdAt' | 'updatedAt'
> & {
  version?: string;
  author?: string;
};

export type SkillUpdateInput = Partial<
  Pick<SkillCreateInput, 'name' | 'description' | 'content' | 'tags' | 'version'>
>;

interface ParsedFrontmatter {
  name?: unknown;
  description?: unknown;
  tags?: unknown;
  isBuiltIn?: unknown;
  version?: unknown;
  author?: unknown;
}

function applyMetaField(meta: ParsedFrontmatter, key: string, val: string): void {
  if (key === 'tags') {
    const captured = /^\[([^\]]*)\]$/.exec(val)?.[1] ?? '';
    meta.tags = captured
      ? captured
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  } else if (key === 'isBuiltIn') {
    meta.isBuiltIn = val === 'true';
  } else if (key) {
    (meta as Record<string, unknown>)[key] = val;
  }
}

function parseFrontmatter(raw: string): { meta: ParsedFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw.trimStart());
  if (!match?.[1])
    throw new ValidationError('content', 'Missing or invalid frontmatter (expected --- block)');
  const body = (match[2] ?? '').trim();
  const meta: ParsedFrontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    applyMetaField(meta, line.slice(0, colonIdx).trim(), line.slice(colonIdx + 1).trim());
  }
  return { meta, body };
}

function assertName(name: string): void {
  if (!name.trim()) throw new ValidationError('name', 'Skill name is required');
}

export class Skill {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly tags: string[];
  readonly version: string;
  readonly author: string | undefined;
  readonly isBuiltIn: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: SkillProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.content = props.content;
    this.tags = props.tags;
    this.version = props.version;
    this.author = props.author;
    this.isBuiltIn = props.isBuiltIn;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static fromMarkdown(raw: string, userId: string): Skill {
    const { meta, body } = parseFrontmatter(raw);
    const name = String(meta.name ?? '');
    const description = String(meta.description ?? '');
    if (!meta.name) throw new ValidationError('name', 'Skill name is required in frontmatter');
    if (!meta.description)
      throw new ValidationError('description', 'Skill description is required in frontmatter');
    assertName(name);
    const now = new Date();
    return new Skill({
      id: randomUUID(),
      userId,
      name,
      description,
      content: body,
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
      version: meta.version ? String(meta.version) : '1.0.0',
      author: meta.author ? String(meta.author) : undefined,
      isBuiltIn: Boolean(meta.isBuiltIn),
      createdAt: now,
      updatedAt: now,
    });
  }

  static create(input: SkillCreateInput): Skill {
    assertName(input.name);
    const now = new Date();
    return new Skill({
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      description: input.description,
      content: input.content,
      tags: [...input.tags],
      version: input.version ?? '1.0.0',
      author: input.author,
      isBuiltIn: input.isBuiltIn,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: SkillProps): Skill {
    return new Skill(props);
  }

  toProps(): SkillProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      content: this.content,
      tags: [...this.tags],
      version: this.version,
      author: this.author,
      isBuiltIn: this.isBuiltIn,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toMarkdown(): string {
    const tagsLine = `tags: [${this.tags.join(', ')}]`;
    const frontmatter = [
      '---',
      `name: ${this.name}`,
      `description: ${this.description}`,
      tagsLine,
      `version: ${this.version}`,
      `isBuiltIn: ${String(this.isBuiltIn)}`,
      ...(this.author ? [`author: ${this.author}`] : []),
      '---',
    ].join('\n');
    return `${frontmatter}\n${this.content}`;
  }

  update(patch: SkillUpdateInput): Skill {
    const name = patch.name ?? this.name;
    assertName(name);
    return new Skill({
      ...this.toProps(),
      name,
      description: patch.description ?? this.description,
      content: patch.content ?? this.content,
      tags: patch.tags ? [...patch.tags] : [...this.tags],
      version: patch.version ?? this.version,
      updatedAt: new Date(),
    });
  }
}
