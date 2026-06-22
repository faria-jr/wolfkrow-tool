import { describe, expect, it } from 'vitest';

import { PIPELINE_TEMPLATES } from '../seed/pipeline-templates';

describe('PIPELINE_TEMPLATES', () => {
  it('exports at least 5 templates', () => {
    expect(PIPELINE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('each template has required fields', () => {
    for (const t of PIPELINE_TEMPLATES) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.stages).toBe('object');
      expect(Array.isArray(t.stages)).toBe(true);
      expect(t.stages.length).toBeGreaterThan(0);
    }
  });

  it('has Security Audit template', () => {
    expect(PIPELINE_TEMPLATES.find((t) => /security/i.test(t.name))).toBeTruthy();
  });

  it('has Architecture Review template', () => {
    expect(PIPELINE_TEMPLATES.find((t) => /architect/i.test(t.name))).toBeTruthy();
  });

  it('template ids are unique', () => {
    const ids = PIPELINE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
