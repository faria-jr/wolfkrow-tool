import { describe, expect, it } from 'vitest';

import { parseFrontmatter, stringifyFrontmatter, splitFrontmatter } from '../frontmatter';

describe('frontmatter', () => {
  it('splits a leading YAML block from the body', () => {
    expect(splitFrontmatter('---\nname: x\n---\nbody')).toEqual({ raw: 'name: x', body: 'body' });
    expect(splitFrontmatter('no frontmatter')).toEqual({ raw: null, body: 'no frontmatter' });
  });

  it('parses simple key/value frontmatter into an object', () => {
    expect(parseFrontmatter('---\nname: pdf\ndescription: A skill\n---\n# Body')).toEqual({
      frontmatter: { name: 'pdf', description: 'A skill' },
      body: '# Body',
    });
  });

  it('parses list values (tags, models, tools)', () => {
    expect(parseFrontmatter('---\ntags:\n  - a\n  - b\n---\nbody')).toEqual({
      frontmatter: { tags: ['a', 'b'] },
      body: 'body',
    });
  });

  it('returns empty frontmatter when none present', () => {
    expect(parseFrontmatter('just body')).toEqual({ frontmatter: {}, body: 'just body' });
  });

  it('stringifies an object back to a frontmatter block', () => {
    const out = stringifyFrontmatter({ name: 'pdf', tags: ['a', 'b'] }, '# Body');
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('name: pdf');
    expect(out).toContain('  - a');
    expect(out.endsWith('# Body')).toBe(true);
  });

  it('round-trips parse → stringify', () => {
    const src = '---\nname: x\n---\nbody';
    const { frontmatter, body } = parseFrontmatter(src);
    expect(stringifyFrontmatter(frontmatter, body)).toBe(src);
  });
});
