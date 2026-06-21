import { describe, expect, it, vi } from 'vitest';

import { createDomainEvent, InMemoryEventBus, type DomainEvent } from '../index';

describe('createDomainEvent', () => {
  it('fills id, occurredAt and freezes payload', () => {
    const event = createDomainEvent({
      type: 'user.created',
      aggregateId: 'u-1',
      payload: { name: 'Wolf' },
    });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.type).toBe('user.created');
    expect(event.aggregateId).toBe('u-1');
    expect(new Date(event.occurredAt).toString()).not.toBe('Invalid Date');
    expect(event.payload).toEqual({ name: 'Wolf' });
    expect(() => Object.assign(event.payload, { x: 1 })).toThrow();
  });

  it('defaults payload to empty object', () => {
    const event = createDomainEvent({ type: 'x', aggregateId: 'a' });
    expect(event.payload).toEqual({});
  });
});

describe('InMemoryEventBus', () => {
  it('delivers published events to subscribed handlers', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn<(e: DomainEvent) => void>();
    bus.subscribe(handler);

    const event = createDomainEvent({ type: 't', aggregateId: '1' });
    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('awaits async handlers in subscription order', async () => {
    const bus = new InMemoryEventBus();
    const order: string[] = [];
    bus.subscribe(async () => {
      order.push('first');
    });
    bus.subscribe(() => {
      order.push('second');
    });

    await bus.publish(createDomainEvent({ type: 't', aggregateId: '1' }));
    expect(order).toEqual(['first', 'second']);
  });
});
