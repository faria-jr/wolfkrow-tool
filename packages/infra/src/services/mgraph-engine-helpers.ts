import type { VaultKind } from '@wolfkrow/domain';

const VAULT_SUBDIRS = ['entities', 'meetings', 'decisions', 'projects', 'references'] as const;
const PATH_RE = /^[a-z0-9\-./]+$/;
const KINDS: readonly string[] = ['entity', 'meeting', 'decision', 'project', 'reference'];

export interface ParsedFrontmatter {
  title: string;
  type: VaultKind;
  tags: string[];
  source?: string;
  created?: string;
  updated?: string;
  body: string;
}

export function sanitizeFilename(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export function validateVaultPath(vaultPath: string): { valid: boolean; error?: string } {
  if (vaultPath.includes('..')) return { valid: false, error: 'Path traversal (..) not allowed' };
  if (vaultPath.includes('//')) return { valid: false, error: 'Double slashes not allowed' };
  if (!PATH_RE.test(vaultPath)) return { valid: false, error: 'Invalid characters in path' };
  const validPrefixes = VAULT_SUBDIRS.map((d) => `${d}/`);
  if (!validPrefixes.some((p) => vaultPath.startsWith(p))) {
    return { valid: false, error: `Path must start with one of: ${validPrefixes.join(', ')}` };
  }
  return { valid: true };
}

export function buildFrontmatter(input: ParsedFrontmatter): string {
  const escape = (s: string) => s.replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${escape(input.title)}"`,
    `type: ${input.type}`,
    `tags: [${input.tags.map((t) => `"${escape(t)}"`).join(', ')}]`,
    ...(input.source ? [`source: ${input.source}`] : []),
    ...(input.created ? [`created: ${input.created}`] : []),
    ...(input.updated ? [`updated: ${input.updated}`] : []),
    '---',
    '',
  ];
  return lines.join('\n');
}

function parseTags(raw: string): string[] {
  const inner = raw.replace(/^\[|\]$/g, '');
  return inner
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter((t) => t.length > 0);
}

function applyFrontmatterLine(fm: ParsedFrontmatter, line: string): void {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return;
  const key = line.slice(0, colonIdx).trim();
  const value = line
    .slice(colonIdx + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
  if (key === 'title') {
    fm.title = value;
    return;
  }
  if (key === 'type') {
    if (KINDS.includes(value)) fm.type = value as VaultKind;
    return;
  }
  if (key === 'tags') {
    fm.tags = parseTags(value);
    return;
  }
  if (key === 'source') {
    fm.source = value;
    return;
  }
  if (key === 'created') {
    fm.created = value;
    return;
  }
  if (key === 'updated') {
    fm.updated = value;
  }
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match?.[1]) {
    return { title: '', type: 'entity', tags: [], body: content };
  }
  const fm: ParsedFrontmatter = { title: '', type: 'entity', tags: [], body: match[2] ?? '' };
  for (const line of match[1].split('\n')) {
    applyFrontmatterLine(fm, line);
  }
  return fm;
}
