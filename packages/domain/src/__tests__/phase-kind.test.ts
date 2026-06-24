import { describe, expect, it } from 'vitest';

import { phaseKindFor } from '../entities/phase-kind';

describe('phaseKindFor (M5.4)', () => {
  it('returns "auto" for non-conversation stages', () => {
    expect(phaseKindFor('discovery')).toBe('auto');
    expect(phaseKindFor('spec_build')).toBe('auto');
    expect(phaseKindFor('spec_validate')).toBe('auto');
    expect(phaseKindFor('implementation')).toBe('auto');
    expect(phaseKindFor('completed')).toBe('auto');
  });

  it('returns "conversation" for the approval checkpoint', () => {
    expect(phaseKindFor('approval')).toBe('conversation');
  });
});
