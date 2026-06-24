import { describe, expect, it } from 'vitest';

import { Artifact, isArtifact } from '../artifact';

const baseProps = {
  id: 'a1',
  type: 'image' as const,
  toolName: 'image-gen',
  data: { imageBase64: 'abc', mimeType: 'image/png' },
};

describe('Artifact', () => {
  it('creates with valid props', () => {
    const a = Artifact.create(baseProps);
    expect(a.id).toBe('a1');
    expect(a.type).toBe('image');
    expect(a.toolName).toBe('image-gen');
    expect(a.data).toEqual(baseProps.data);
  });

  it('returns title when provided', () => {
    const a = Artifact.create({ ...baseProps, title: 'A nice image' });
    expect(a.title).toBe('A nice image');
  });

  it('returns undefined title when omitted', () => {
    const a = Artifact.create(baseProps);
    expect(a.title).toBeUndefined();
  });

  it('throws when id missing', () => {
    expect(() => Artifact.create({ ...baseProps, id: '' })).toThrow(/id required/);
  });

  it('throws when toolName missing', () => {
    expect(() => Artifact.create({ ...baseProps, toolName: '' })).toThrow(/toolName required/);
  });

  it('throws when data missing', () => {
    expect(() => Artifact.create({ ...baseProps, data: undefined as unknown as never })).toThrow(/data must be an object/);
  });

  it('toJSON returns a shallow copy', () => {
    const a = Artifact.create(baseProps);
    const json = a.toJSON();
    expect(json).toEqual(baseProps);
    json.id = 'mutated';
    expect(a.id).toBe('a1');
  });

  it('isArtifact narrows correctly', () => {
    const a = Artifact.create(baseProps);
    expect(isArtifact(a)).toBe(true);
    expect(isArtifact({})).toBe(false);
    expect(isArtifact(null)).toBe(false);
  });
});