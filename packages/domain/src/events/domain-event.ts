import { randomUUID } from 'node:crypto';

import { Timestamp } from '../value-objects/timestamp';

/**
 * Contrato de evento de domínio. Imutável. `type` identifica o evento,
 * `aggregateId` a raiz de agregado que o emitiu, `payload` os dados.
 */
export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Constrói um DomainEvent com id/occurredAt gerados. */
export function createDomainEvent(params: {
  type: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}): DomainEvent {
  return {
    id: randomUUID(),
    type: params.type,
    aggregateId: params.aggregateId,
    occurredAt: Timestamp.now().value,
    payload: Object.freeze({ ...params.payload }),
  };
}
