import { createDomainEvent } from '@wolfkrow/domain';
import { describe, expect, it, vi } from 'vitest';

import { ConsoleLogger, createContainer, NoopLogger, type UseCase } from '../index';

class GreetUseCase implements UseCase<{ name: string }, string> {
  async execute(input: { name: string }): Promise<string> {
    return `Hello ${input.name}`;
  }
}

describe('UseCase convention', () => {
  it('implements execute(input) -> output', async () => {
    const uc = new GreetUseCase();
    expect(await uc.execute({ name: 'Wolf' })).toBe('Hello Wolf');
  });
});

describe('createContainer (composition root)', () => {
  it('wires a working eventBus and logger', async () => {
    const container = createContainer();
    const handler = vi.fn();
    container.eventBus.subscribe(handler);

    const event = createDomainEvent({ type: 'x', aggregateId: '1' });
    await container.eventBus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(container.logger).toBeDefined();
  });
});

describe('ConsoleLogger', () => {
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    it(`${level} delegates to console.${level} with context`, () => {
      const spy = vi.spyOn(console, level).mockImplementation(() => undefined);
      new ConsoleLogger()[level]('msg', { k: 1 });
      expect(spy).toHaveBeenCalledWith('msg', { k: 1 });
      spy.mockRestore();
    });
  }

  it('defaults context to empty object for every level', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      const spy = vi.spyOn(console, level).mockImplementation(() => undefined);
      new ConsoleLogger()[level]('msg');
      expect(spy).toHaveBeenCalledWith('msg', {});
      spy.mockRestore();
    }
  });
});

describe('NoopLogger', () => {
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    it(`${level} produces no console output`, () => {
      const spy = vi.spyOn(console, level);
      new NoopLogger()[level]('msg');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  }
});
