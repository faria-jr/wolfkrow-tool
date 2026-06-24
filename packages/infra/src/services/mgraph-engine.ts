import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';

import {
  extractWikilinks,
  VaultNote,
  type VaultGraphData,
  type VaultGraphEdge,
  type VaultGraphNode,
  type VaultKind,
} from '@wolfkrow/domain';

const VAULT_SUBDIRS = ['entities', 'meetings', 'decisions', 'projects', 'references'] as const;
const PATH_RE = /^[a-z0-9\-./]+$/;

export interface MgraphSearchResult {
  path: string;
  title: string;
  snippet: string;
}

export interface MgraphStats {
  noteCount: number;
  byKind: Record<VaultKind, number>;
  edgeCount: number;
}

export interface MgraphSearchOptions {
  query: string;
  limit?: number;
  kind?: VaultKind;
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

interface ParsedFrontmatter {
  title: string;
  type: VaultKind;
  tags: string[];
  source?: string;
  created?: string;
  updated?: string;
  body: string;
}

function buildFrontmatter(input: ParsedFrontmatter): string {
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

function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match || !match[1]) {
    return { title: '', type: 'entity', tags: [], body: content };
  }
  const fm: ParsedFrontmatter = { title: '', type: 'entity', tags: [], body: match[2] ?? '' };
  const fmBlock = match[1];
  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key === 'title') fm.title = value;
    else if (key === 'type') {
      if ((['entity', 'meeting', 'decision', 'project', 'reference'] as readonly string[]).includes(value)) {
        fm.type = value as VaultKind;
      }
    } else if (key === 'tags') {
      const inner = value.replace(/^\[|\]$/g, '');
      fm.tags = inner
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter((t) => t.length > 0);
    } else if (key === 'source') fm.source = value;
    else if (key === 'created') fm.created = value;
    else if (key === 'updated') fm.updated = value;
  }
  return fm;
}

export interface CreateVaultNoteInput {
  path: string;
  kind: VaultKind;
  title: string;
  tags?: string[];
  body: string;
  source?: string;
}

export interface MgraphEngineOptions {
  vaultRoot: string;
}

export class MgraphEngine {
  constructor(private readonly opts: MgraphEngineOptions) {}

  getVaultRoot(): string {
    return this.opts.vaultRoot;
  }

  async ensureVault(): Promise<void> {
    await mkdir(this.opts.vaultRoot, { recursive: true });
    for (const sub of VAULT_SUBDIRS) {
      await mkdir(join(this.opts.vaultRoot, sub), { recursive: true });
    }
  }

  private resolveSafe(path: string): string {
    const validation = validateVaultPath(path);
    if (!validation.valid) throw new Error(`Invalid vault path: ${validation.error}`);
    const root = normalize(this.opts.vaultRoot);
    const abs = normalize(resolve(root, path));
    if (!abs.startsWith(root + sep) && abs !== root) {
      throw new Error('Path escapes vault root');
    }
    return abs;
  }

  async createNote(input: CreateVaultNoteInput): Promise<VaultNote> {
    const abs = this.resolveSafe(input.path);
    if (existsSync(abs)) throw new Error(`Note already exists: ${input.path}`);
    await mkdir(dirname(abs), { recursive: true });
    const now = new Date().toISOString();
    const frontmatter: ParsedFrontmatter = {
      title: input.title,
      type: input.kind,
      tags: input.tags ?? [],
      body: input.body,
      ...(input.source ? { source: input.source } : {}),
      created: now,
      updated: now,
    };
    const content = `${buildFrontmatter(frontmatter)}${input.body}\n`;
    await writeFile(abs, content, 'utf8');
    return VaultNote.create({
      path: input.path,
      kind: input.kind,
      title: input.title,
      tags: input.tags ?? [],
      body: input.body,
      ...(input.source ? { source: input.source } : {}),
      wikilinks: extractWikilinks(input.body),
    });
  }

  async readNote(path: string): Promise<VaultNote | null> {
    const abs = this.resolveSafe(path);
    if (!existsSync(abs)) return null;
    const content = await readFile(abs, 'utf8');
    const fm = parseFrontmatter(content);
    return VaultNote.create({
      path,
      kind: fm.type,
      title: fm.title || path,
      tags: fm.tags,
      body: fm.body.trim(),
      ...(fm.source ? { source: fm.source } : {}),
      wikilinks: extractWikilinks(fm.body),
    });
  }

  async updateNote(path: string, body: string, title?: string, tags?: string[]): Promise<VaultNote> {
    const existing = await this.readNote(path);
    if (!existing) throw new Error(`Note not found: ${path}`);
    const abs = this.resolveSafe(path);
    const frontmatter: ParsedFrontmatter = {
      title: title ?? existing.title,
      type: existing.kind,
      tags: tags ?? [...existing.tags],
      body,
      ...(existing.source ? { source: existing.source } : {}),
      updated: new Date().toISOString(),
    };
    const content = `${buildFrontmatter(frontmatter)}${body}\n`;
    await writeFile(abs, content, 'utf8');
    return VaultNote.create({
      path,
      kind: existing.kind,
      title: frontmatter.title,
      tags: frontmatter.tags,
      body,
      ...(existing.source ? { source: existing.source } : {}),
      wikilinks: extractWikilinks(body),
    });
  }

  async deleteNote(path: string): Promise<void> {
    const abs = this.resolveSafe(path);
    if (!existsSync(abs)) return;
    await unlink(abs);
  }

  async listAllNotes(): Promise<VaultNote[]> {
    if (!existsSync(this.opts.vaultRoot)) return [];
    const out: VaultNote[] = [];
    for (const sub of VAULT_SUBDIRS) {
      const subDir = join(this.opts.vaultRoot, sub);
      if (!existsSync(subDir)) continue;
      const entries = await readdir(subDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const relPath = `${sub}/${entry.name}`;
        const note = await this.readNote(relPath);
        if (note) out.push(note);
      }
    }
    return out;
  }

  async listByKind(kind: VaultKind): Promise<VaultNote[]> {
    const all = await this.listAllNotes();
    return all.filter((n) => n.kind === kind);
  }

  async buildGraphData(): Promise<VaultGraphData> {
    const notes = await this.listAllNotes();
    const nodes: VaultGraphNode[] = notes.map((n) => ({
      id: n.path,
      title: n.title,
      kind: n.kind,
      tags: [...n.tags],
      path: n.path,
    }));
    const edges: VaultGraphEdge[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
      for (const target of note.wikilinks) {
        const targetSlug = sanitizeFilename(target);
        const match = nodes.find(
          (n) => sanitizeFilename(n.title) === targetSlug || n.path.endsWith(`/${targetSlug}.md`),
        );
        if (match) {
          const edgeKey = `${note.path}->${match.path}`;
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            edges.push({ source: note.path, target: match.path });
          }
        }
      }
    }
    return { nodes, edges };
  }

  async searchVault(opts: MgraphSearchOptions): Promise<MgraphSearchResult[]> {
    const notes = await this.listAllNotes();
    const lower = opts.query.toLowerCase();
    const limit = opts.limit ?? 20;
    const out: MgraphSearchResult[] = [];
    for (const note of notes) {
      if (opts.kind && note.kind !== opts.kind) continue;
      const titleHit = note.title.toLowerCase().includes(lower);
      const bodyHit = note.body.toLowerCase().includes(lower);
      if (!titleHit && !bodyHit) continue;
      const idx = note.body.toLowerCase().indexOf(lower);
      const snippet = idx >= 0
        ? note.body.slice(Math.max(0, idx - 30), idx + lower.length + 30)
        : note.body.slice(0, 80);
      out.push({ path: note.path, title: note.title, snippet });
      if (out.length >= limit) break;
    }
    return out;
  }

  async getStats(): Promise<MgraphStats> {
    const notes = await this.listAllNotes();
    const byKind: Record<VaultKind, number> = {
      entity: 0, meeting: 0, decision: 0, project: 0, reference: 0,
    };
    for (const n of notes) byKind[n.kind]++;
    const graph = await this.buildGraphData();
    return { noteCount: notes.length, byKind, edgeCount: graph.edges.length };
  }

  /** Read raw markdown file content (for export / display). */
  async readRaw(path: string): Promise<string | null> {
    const abs = this.resolveSafe(path);
    if (!existsSync(abs)) return null;
    return readFile(abs, 'utf8');
  }

  /** Test helper: list files relative to vault root. */
  async listFiles(): Promise<string[]> {
    if (!existsSync(this.opts.vaultRoot)) return [];
    const out: string[] = [];
    for (const sub of VAULT_SUBDIRS) {
      const subDir = join(this.opts.vaultRoot, sub);
      if (!existsSync(subDir)) continue;
      const entries = await readdir(subDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          out.push(relative(this.opts.vaultRoot, join(subDir, entry.name)));
        }
      }
    }
    return out;
  }

  /** Test helper: get file size for diagnostics. */
  async getSize(path: string): Promise<number | null> {
    const abs = this.resolveSafe(path);
    if (!existsSync(abs)) return null;
    const s = await stat(abs);
    return s.size;
  }
}
