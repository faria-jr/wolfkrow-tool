import { describe, expect, it } from 'vitest';

import {
  CreateSkillInputSchema,
  CreateSkillRequestBodySchema,
  SkillFrontmatterSchema,
  SkillSchema,
  UpdateSkillInputSchema,
  UpdateSkillRequestBodySchema,
} from '../schemas/skill';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const ts = '2024-01-01T00:00:00Z';

describe('skill schemas', () => {
  describe('SkillFrontmatterSchema', () => {
    it('accepts valid frontmatter and applies defaults', () => {
      const parsed = SkillFrontmatterSchema.parse({
        name: 'skill',
        description: 'desc',
      });
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.tags).toEqual([]);
      expect(parsed.requires).toEqual([]);
      expect(parsed.metadata).toEqual({});
    });
    it('rejects missing name', () => {
      expect(() => SkillFrontmatterSchema.parse({ description: 'desc' })).toThrow();
    });
    it('rejects missing description', () => {
      expect(() => SkillFrontmatterSchema.parse({ name: 's' })).toThrow();
    });
    it('rejects description over 500 chars', () => {
      expect(() =>
        SkillFrontmatterSchema.parse({
          name: 's',
          description: 'a'.repeat(501),
        })
      ).toThrow();
    });
  });

  describe('SkillSchema', () => {
    const valid = {
      id: uuid,
      userId: uuid,
      name: 'skill',
      description: 'desc',
      content: 'body',
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    };
    it('accepts a valid skill and applies defaults', () => {
      const parsed = SkillSchema.parse(valid);
      expect(parsed.tags).toEqual([]);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.isBuiltIn).toBe(false);
    });
    it('rejects empty content', () => {
      expect(() => SkillSchema.parse({ ...valid, content: '' })).toThrow();
    });
    it('rejects missing name', () => {
      const { name: _omit, ...rest } = valid;
      expect(() => SkillSchema.parse(rest)).toThrow();
    });
    it('rejects non-uuid id', () => {
      expect(() => SkillSchema.parse({ ...valid, id: 'x' })).toThrow();
    });
  });

  describe('CreateSkillInputSchema', () => {
    it('accepts the input subset and applies defaults', () => {
      const parsed = CreateSkillInputSchema.parse({
        name: 's',
        description: 'd',
        content: 'c',
      });
      expect(parsed.tags).toEqual([]);
      expect(parsed.isBuiltIn).toBe(false);
    });
    it('rejects missing content', () => {
      expect(() => CreateSkillInputSchema.parse({ name: 's', description: 'd' })).toThrow();
    });
  });

  describe('UpdateSkillInputSchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateSkillInputSchema.parse({})).toEqual({});
    });
    it('rejects empty content when provided', () => {
      expect(() => UpdateSkillInputSchema.parse({ content: '' })).toThrow();
    });
  });

  describe('CreateSkillRequestBodySchema', () => {
    it('applies defaults (lenient empty strings)', () => {
      const parsed = CreateSkillRequestBodySchema.parse({});
      expect(parsed.name).toBe('');
      expect(parsed.description).toBe('');
      expect(parsed.content).toBe('');
      expect(parsed.tags).toEqual([]);
    });
    it('rejects name over 255 chars', () => {
      expect(() => CreateSkillRequestBodySchema.parse({ name: 'a'.repeat(256) })).toThrow();
    });
  });

  describe('UpdateSkillRequestBodySchema', () => {
    it('accepts an empty object (all optional)', () => {
      expect(UpdateSkillRequestBodySchema.parse({})).toEqual({});
    });
    it('rejects name over 255 when provided', () => {
      expect(() => UpdateSkillRequestBodySchema.parse({ name: 'a'.repeat(256) })).toThrow();
    });
  });
});
