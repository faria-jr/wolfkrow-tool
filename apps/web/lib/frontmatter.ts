/**
 * DEBT #14 (EPIC 3.2) — Minimal YAML frontmatter parser/serializer.
 *
 * Handles the flat key/value + list shape used by agent/skill/rule markdown
 * (.claude/agents/*.md, skills/*.md, rules/*.md). No nested mappings, no
 * anchors — deliberately small so we avoid a gray-matter dependency. Values
 * are scalars or string arrays.
 */

export type FrontmatterValue = string | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

const FENCE = '---';

/** Split a leading `---\n...\n---` block from the body (raw YAML + body). */
export function splitFrontmatter(src: string): { raw: string | null; body: string } {
  if (!src.startsWith(`${FENCE}\n`)) return { raw: null, body: src };
  const end = src.indexOf(`\n${FENCE}\n`, FENCE.length + 1);
  if (end === -1) return { raw: null, body: src };
  const raw = src.slice(FENCE.length + 1, end);
  const body = src.slice(end + FENCE.length + 2);
  return { raw, body: body.startsWith('\n') ? body.slice(1) : body };
}

function parseScalar(raw: string): string {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Parse frontmatter + body from a markdown source. */
export function parseFrontmatter(src: string): { frontmatter: Frontmatter; body: string } {
  const { raw, body } = splitFrontmatter(src);
  if (!raw) return { frontmatter: {}, body };
  const frontmatter: Frontmatter = {};
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) { i += 1; continue; }
    const [, key, inline] = match;
    if (inline && inline.trim()) {
      frontmatter[key!] = parseScalar(inline);
      i += 1;
      continue;
    }
    // list block: subsequent `  - item` lines
    const items: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^\s+-\s+/.test(lines[j]!)) {
      items.push(parseScalar(lines[j]!.replace(/^\s+-\s+/, '')));
      j += 1;
    }
    if (items.length > 0) frontmatter[key!] = items;
    i = j;
  }
  return { frontmatter, body };
}

/** Serialize frontmatter + body back to a markdown source. */
export function stringifyFrontmatter(frontmatter: Frontmatter, body: string): string {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return body;
  const lines: string[] = [FENCE];
  for (const key of keys) {
    const value = frontmatter[key]!;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const v of value) lines.push(`  - ${v}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push(FENCE);
  return [...lines, body].join('\n');
}
