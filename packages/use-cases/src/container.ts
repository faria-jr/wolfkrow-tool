import { type EventBus, InMemoryEventBus } from '@wolfkrow/domain';

import { ConsoleLogger, type Logger } from './logger';

/**
 * Composition root (DI manual — desvio justificado do tsyringe do plano):
 * sem decorators/reflect-metadata e sem alterar tsconfig. Casos de uso recebem
 * ports via construtor; este módulo os instancia com adaptadores concretos.
 *
 * Cresce por fase à medida que ports surgem:
 *   A.1: userRepo, sessionRepo, passwordHasher, totpVerifier
 *   A.2: aiProviderFactory
 *   A.3: chatSessionRepo, messageRepo
 */
export interface AppContainer {
  readonly eventBus: EventBus;
  readonly logger: Logger;
}

export function createContainer(): AppContainer {
  return {
    eventBus: new InMemoryEventBus(),
    logger: new ConsoleLogger(),
  };
}
