import type { HydePort } from '@wolfkrow/domain';

/**
 * Default HyDE adapter when disabled/no key — produces no hypothetical doc.
 */
export class NoOpHyde implements HydePort {
  readonly enabled = false;

  async generate(): Promise<string | null> {
    return null;
  }
}
