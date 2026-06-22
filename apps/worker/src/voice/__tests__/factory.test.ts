import { describe, expect, it } from 'vitest';

import { CartesiaTtsProvider } from '../cartesia';
import { ElevenLabsTtsProvider } from '../elevenlabs';
import { createTtsProvider } from '../factory';

/**
 * FIX-030: TTS provider must be selectable. The /synthesize route accepted a
 * `provider` body field but always constructed ElevenLabs. This factory is the
 * single switch used by both routes.
 */
describe('createTtsProvider (FIX-030)', () => {
  it('returns ElevenLabsTtsProvider for "elevenlabs"', () => {
    const provider = createTtsProvider('elevenlabs', 'key-el');
    expect(provider).toBeInstanceOf(ElevenLabsTtsProvider);
  });

  it('returns CartesiaTtsProvider for "cartesia"', () => {
    const provider = createTtsProvider('cartesia', 'key-carta');
    expect(provider).toBeInstanceOf(CartesiaTtsProvider);
  });

  it('falls back to ElevenLabs for unknown provider names', () => {
    const provider = createTtsProvider('unknown' as never, 'key');
    expect(provider).toBeInstanceOf(ElevenLabsTtsProvider);
  });
});
