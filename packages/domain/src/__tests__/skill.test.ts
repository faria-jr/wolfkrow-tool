import { describe, expect, it } from 'vitest';

import { Skill } from '../entities/skill';
import { ValidationError } from '../errors/domain-error';

const VALID_MD = `---
name: pdf-processing
description: Extract text from PDFs
tags: [documents, parsing]
isBuiltIn: false
---
# PDF Processing

Use pdf-parse to extract text.`;

const BUILTIN_MD = `---
name: code-review
description: Review code for quality
tags: [quality]
isBuiltIn: true
version: 2.0.0
---
Content here.`;

describe('Skill entity', () => {
  describe('fromMarkdown', () => {
    it('parses valid markdown with frontmatter', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'user-1');
      expect(skill.name).toBe('pdf-processing');
      expect(skill.description).toBe('Extract text from PDFs');
      expect(skill.tags).toEqual(['documents', 'parsing']);
      expect(skill.isBuiltIn).toBe(false);
      expect(skill.content).toContain('# PDF Processing');
    });

    it('assigns userId', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'user-42');
      expect(skill.userId).toBe('user-42');
    });

    it('generates id on creation', () => {
      const s1 = Skill.fromMarkdown(VALID_MD, 'u');
      const s2 = Skill.fromMarkdown(VALID_MD, 'u');
      expect(s1.id).toBeTruthy();
      expect(s1.id).not.toBe(s2.id);
    });

    it('parses isBuiltIn true', () => {
      const skill = Skill.fromMarkdown(BUILTIN_MD, 'user-1');
      expect(skill.isBuiltIn).toBe(true);
      expect(skill.version).toBe('2.0.0');
    });

    it('defaults version to 1.0.0 when absent', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'u');
      expect(skill.version).toBe('1.0.0');
    });

    it('defaults tags to [] when absent', () => {
      const md = `---\nname: foo\ndescription: bar\n---\nbody`;
      const skill = Skill.fromMarkdown(md, 'u');
      expect(skill.tags).toEqual([]);
    });

    it('throws ValidationError when name missing', () => {
      const md = `---\ndescription: no name\n---\nbody`;
      expect(() => Skill.fromMarkdown(md, 'u')).toThrow(ValidationError);
    });

    it('throws ValidationError when description missing', () => {
      const md = `---\nname: foo\n---\nbody`;
      expect(() => Skill.fromMarkdown(md, 'u')).toThrow(ValidationError);
    });

    it('throws ValidationError for missing frontmatter', () => {
      expect(() => Skill.fromMarkdown('just text', 'u')).toThrow(ValidationError);
    });

    it('throws ValidationError for empty name', () => {
      const md = `---\nname: \ndescription: x\n---\nbody`;
      expect(() => Skill.fromMarkdown(md, 'u')).toThrow(ValidationError);
    });
  });

  describe('create', () => {
    it('creates skill with all fields', () => {
      const skill = Skill.create({
        userId: 'u1',
        name: 'my-skill',
        description: 'My skill',
        content: '# My skill',
        tags: ['a', 'b'],
        isBuiltIn: false,
      });
      expect(skill.name).toBe('my-skill');
      expect(skill.id).toBeTruthy();
      expect(skill.createdAt).toBeInstanceOf(Date);
    });

    it('throws ValidationError for empty name', () => {
      expect(() =>
        Skill.create({
          userId: 'u',
          name: '',
          description: 'x',
          content: 'y',
          tags: [],
          isBuiltIn: false,
        })
      ).toThrow(ValidationError);
    });
  });

  describe('toProps / fromProps', () => {
    it('roundtrips', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'u');
      const props = skill.toProps();
      const restored = Skill.fromProps(props);
      expect(restored.name).toBe(skill.name);
      expect(restored.id).toBe(skill.id);
      expect(restored.content).toBe(skill.content);
    });
  });

  describe('toMarkdown', () => {
    it('serializes back to markdown with frontmatter', () => {
      const skill = Skill.create({
        userId: 'u',
        name: 'test',
        description: 'desc',
        content: '# Body',
        tags: ['x'],
        isBuiltIn: false,
      });
      const md = skill.toMarkdown();
      expect(md).toContain('name: test');
      expect(md).toContain('description: desc');
      expect(md).toContain('tags:');
      expect(md).toContain('# Body');
    });
  });

  describe('update', () => {
    it('patches name and description', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'u');
      const updated = skill.update({ name: 'new-name', description: 'new-desc' });
      expect(updated.name).toBe('new-name');
      expect(updated.description).toBe('new-desc');
      expect(updated.id).toBe(skill.id);
    });

    it('throws ValidationError for empty name', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'u');
      expect(() => skill.update({ name: '' })).toThrow(ValidationError);
    });

    it('updates updatedAt', () => {
      const skill = Skill.fromMarkdown(VALID_MD, 'u');
      const before = skill.updatedAt.getTime();
      const updated = skill.update({ name: 'x' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
