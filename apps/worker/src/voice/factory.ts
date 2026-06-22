/**
 * TTS provider factory (FIX-030).
 *
 * The /synthesize route accepted a `provider` body field but always constructed
 * `ElevenLabsTtsProvider`, so Cartesia was unreachable. This is the single
 * switch both routes use to resolve a provider by name.
 */

import { CartesiaTtsProvider } from './cartesia';
import { ElevenLabsTtsProvider } from './elevenlabs';
import type { TtsProvider } from './types';

export type TtsProviderName = 'elevenlabs' | 'cartesia';

export function createTtsProvider(name: string, apiKey: string): TtsProvider {
  switch (name) {
    case 'cartesia':
      return new CartesiaTtsProvider(apiKey);
    case 'elevenlabs':
    default:
      return new ElevenLabsTtsProvider(apiKey);
  }
}
