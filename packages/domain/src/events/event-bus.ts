import type { DomainEvent } from './domain-event';

/** Handler assíncrono de evento. */
export type EventHandler = (event: DomainEvent) => Promise<void> | void;

/**
 * Port do barramento de eventos. Use-cases publicam; a infra implementa
 * (in-memory p/ testes, ou persistente/async no worker).
 */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(handler: EventHandler): void;
}

/** Implementação in-memory (zero deps) — default para use-cases e testes. */
export class InMemoryEventBus implements EventBus {
  private readonly handlers: EventHandler[] = [];

  subscribe(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}
