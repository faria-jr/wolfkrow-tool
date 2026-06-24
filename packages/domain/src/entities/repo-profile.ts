export type RoleMap = Record<string, string[]>;

export interface RepoProfileProps {
  root: string;
  languages: string[];
  frameworks: string[];
  roles: RoleMap;
  fileCount: number;
}

export class RepoProfile {
  readonly root: string;
  readonly languages: readonly string[];
  readonly frameworks: readonly string[];
  readonly roles: Readonly<RoleMap>;
  readonly fileCount: number;

  private constructor(props: RepoProfileProps) {
    this.root = props.root;
    this.languages = [...props.languages];
    this.frameworks = [...props.frameworks];
    this.roles = { ...props.roles };
    this.fileCount = props.fileCount;
  }

  static create(props: RepoProfileProps): RepoProfile {
    return new RepoProfile(props);
  }

  roleFiles(role: string): string[] {
    return [...(this.roles[role] ?? [])];
  }

  toSummary(): string {
    if (this.fileCount === 0 && this.languages.length === 0) {
      return 'Empty repository — no source files detected.';
    }
    const parts: string[] = [`${this.fileCount} files`];
    if (this.languages.length > 0) parts.push(`Languages: ${this.languages.join(', ')}`);
    if (this.frameworks.length > 0) parts.push(`Frameworks: ${this.frameworks.join(', ')}`);
    const roleNames = Object.keys(this.roles);
    if (roleNames.length > 0) parts.push(`Roles: ${roleNames.join(', ')}`);
    return parts.join(' | ');
  }
}
