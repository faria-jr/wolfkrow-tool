import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Skill } from '@wolfkrow/domain';

const SYSTEM_USER_ID = 'system';

function resolveSkillsDir(): string {
  const override = process.env.WOLFKROW_SKILLS_DIR;
  if (override) return resolve(override);

  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', '..', '.wolfkrow', 'skills');
}

function parseTagsValue(val: string): string[] {
  const captured = /^\[([^\]]*)\]$/.exec(val)?.[1] ?? '';
  return captured ? captured.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function applyMetaLine(meta: Record<string, unknown>, line: string): void {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return;
  const key = line.slice(0, colonIdx).trim();
  if (!key) return;
  const val = line.slice(colonIdx + 1).trim();
  if (key === 'tags') {
    meta.tags = parseTagsValue(val);
  } else if (key === 'isBuiltIn') {
    meta.isBuiltIn = val === 'true';
  } else {
    meta[key] = val;
  }
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw.trimStart());
  if (!match?.[1]) throw new Error('Missing or invalid frontmatter');
  const body = (match[2] ?? '').trim();
  const meta: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    applyMetaLine(meta, line);
  }
  return { meta, body };
}

function buildSkillFromMarkdown(raw: string): Skill {
  const { meta, body } = parseFrontmatter(raw);
  const name = String(meta.name ?? '').trim();
  const description = String(meta.description ?? '').trim();
  if (!name) throw new Error('Skill name is required in frontmatter');
  if (!description) throw new Error('Skill description is required in frontmatter');

  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  const version = meta.version ? String(meta.version) : '1.0.0';
  const isBuiltIn = meta.isBuiltIn !== undefined ? Boolean(meta.isBuiltIn) : true;

  const createInput: Parameters<typeof Skill.create>[0] = {
    userId: SYSTEM_USER_ID,
    name,
    description,
    content: body,
    tags: [...tags],
    version,
    isBuiltIn,
  };
  const author = meta.author ? String(meta.author) : undefined;
  if (author !== undefined) createInput.author = author;

  return Skill.create(createInput);
}

export interface LoadedSkill {
  name: string;
  filePath: string;
  skill: Skill;
}

export async function loadBuiltInSkills(dir?: string): Promise<LoadedSkill[]> {
  const skillsDir = dir ?? resolveSkillsDir();
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }
  const mdFiles = entries.filter((f) => f.endsWith('.md'));
  const results: LoadedSkill[] = [];
  for (const file of mdFiles) {
    const filePath = join(skillsDir, file);
    const raw = await readFile(filePath, 'utf-8');
    const skill = buildSkillFromMarkdown(raw);
    results.push({ name: skill.name, filePath, skill });
  }
  return results;
}
