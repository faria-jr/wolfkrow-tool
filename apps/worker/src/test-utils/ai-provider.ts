/**
 * Agent executor factory
 *
 * Allows injecting a mock provider for tests.
 */

import type { AIProvider, AIProviderFactory } from '@wolfkrow/infra';

export function createTestAIProviderFactory(provider: AIProvider): AIProviderFactory {
  return {
    create() {
      return provider;
    },
    createFromConfig() {
      return provider;
    },
  };
}
