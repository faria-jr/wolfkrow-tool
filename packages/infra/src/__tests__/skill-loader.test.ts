import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadBuiltInSkills } from '../seed/skill-loader';

describe('skill-loader (loadBuiltInSkills)', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wolfkrow-skills-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('returns empty array when directory does not exist', async () => {
    const loaded = await loadBuiltInSkills(join(workDir, 'missing'));
    expect(loaded).toEqual([]);
  });

  it('returns empty array when directory has no .md files', async () => {
    await mkdir(workDir, { recursive: true });
    await writeFile(join(workDir, 'readme.txt'), 'not a skill');
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded).toEqual([]);
  });

  it('loads a single valid skill', async () => {
    await writeFile(
      join(workDir, 'pdf.md'),
      `---
name: pdf
description: Process PDF files.
tags: [documentos]
version: 1.0.0
isBuiltIn: true
---

# PDF Skill

Use pypdf.`,
    );
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('pdf');
    expect(loaded[0]?.skill.name).toBe('pdf');
    expect(loaded[0]?.skill.description).toBe('Process PDF files.');
    expect(loaded[0]?.skill.tags).toEqual(['documentos']);
    expect(loaded[0]?.skill.isBuiltIn).toBe(true);
    expect(loaded[0]?.skill.version).toBe('1.0.0');
    expect(loaded[0]?.skill.content).toContain('# PDF Skill');
    expect(loaded[0]?.skill.content).toContain('Use pypdf.');
  });

  it('defaults isBuiltIn to true and version to 1.0.0', async () => {
    await writeFile(
      join(workDir, 'minimal.md'),
      `---
name: minimal
description: Bare minimum.
---

body`,
    );
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded[0]?.skill.isBuiltIn).toBe(true);
    expect(loaded[0]?.skill.version).toBe('1.0.0');
    expect(loaded[0]?.skill.tags).toEqual([]);
  });

  it('defaults tags to empty when omitted', async () => {
    await writeFile(
      join(workDir, 'no-tags.md'),
      `---
name: no-tags
description: without tags
---
content`,
    );
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded[0]?.skill.tags).toEqual([]);
  });

  it('loads multiple skills sorted by file order', async () => {
    await writeFile(
      join(workDir, 'second.md'),
      `---
name: second
description: second skill
---
body 2`,
    );
    await writeFile(
      join(workDir, 'first.md'),
      `---
name: first
description: first skill
---
body 1`,
    );
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded).toHaveLength(2);
    const names = loaded.map((l) => l.name);
    expect(names).toContain('first');
    expect(names).toContain('second');
  });

  it('skips file with missing frontmatter instead of throwing', async () => {
    await writeFile(join(workDir, 'broken.md'), 'no frontmatter here');
    const results = await loadBuiltInSkills(workDir);
    expect(results.map((r) => r.name)).not.toContain('broken');
  });

  it('skips file with missing name instead of throwing', async () => {
    await writeFile(
      join(workDir, 'no-name.md'),
      `---
description: missing name
---
body`,
    );
    const results = await loadBuiltInSkills(workDir);
    expect(results.map((r) => r.name)).not.toContain('no-name');
  });

  it('skips file with missing description instead of throwing', async () => {
    await writeFile(
      join(workDir, 'no-desc.md'),
      `---
name: no-desc
---
body`,
    );
    const results = await loadBuiltInSkills(workDir);
    expect(results.map((r) => r.name)).not.toContain('no-desc');
  });

  it('preserves author when present', async () => {
    await writeFile(
      join(workDir, 'with-author.md'),
      `---
name: with-author
description: with author field
author: Wolfkrow Team
---
body`,
    );
    const loaded = await loadBuiltInSkills(workDir);
    expect(loaded[0]?.skill.author).toBe('Wolfkrow Team');
  });
});
