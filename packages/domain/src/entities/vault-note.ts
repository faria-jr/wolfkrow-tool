export const VAULT_KINDS = [
  'entity',
  'meeting',
  'decision',
  'project',
  'reference',
] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

export interface VaultNoteProps {
  id?: string;
  path: string;
  kind: VaultKind;
  title: string;
  tags: string[];
  body: string;
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
  wikilinks?: string[];
}

export class VaultNote {
  private constructor(private readonly props: VaultNoteProps) {}

  static create(props: VaultNoteProps): VaultNote {
    if (!props.path) throw new Error('VaultNote: path required');
    if (!VAULT_KINDS.includes(props.kind)) {
      throw new Error(`VaultNote: invalid kind ${props.kind}`);
    }
    if (!props.title) throw new Error('VaultNote: title required');
    return new VaultNote(props);
  }

  get id(): string | undefined { return this.props.id; }
  get path(): string { return this.props.path; }
  get kind(): VaultKind { return this.props.kind; }
  get title(): string { return this.props.title; }
  get tags(): readonly string[] { return this.props.tags; }
  get body(): string { return this.props.body; }
  get source(): string | undefined { return this.props.source; }
  get createdAt(): Date { return this.props.createdAt ?? new Date(); }
  get updatedAt(): Date { return this.props.updatedAt ?? this.createdAt; }
  get wikilinks(): readonly string[] { return this.props.wikilinks ?? []; }

  toJSON(): VaultNoteProps {
    return { ...this.props };
  }
}

export interface VaultGraphNode {
  id: string;
  title: string;
  kind: VaultKind;
  tags: string[];
  path: string;
}

export interface VaultGraphEdge {
  source: string;
  target: string;
}

export interface VaultGraphData {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
}

export function extractWikilinks(body: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) {
      out.add(m[1].trim().toLowerCase());
    }
  }
  return [...out];
}
