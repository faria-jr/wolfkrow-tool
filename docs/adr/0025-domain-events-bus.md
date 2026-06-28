# ADR-0025: Domain Events Bus para Comunicação Entre Use-Cases

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

No LionClaw v3, use-cases chamam outros use-cases diretamente, criando acoplamento:

```typescript
// ❌ Acoplamento direto
class SendMessage {
  async execute(input) {
    const agent = await this.agentRepo.findById(...);
    await this.sendMessage(agent, input);
    await this.titleGenerator.generate(agent.session);  // Acoplado
    await this.compactionCheck.check(agent.session);    // Acoplado
    await this.usageTracker.track(agent, tokens);       // Acoplado
  }
}
```

Problemas:

1. **Acoplamento**: SendMessage conhece todos os side effects
2. **Testes quebram**: testar SendMessage requer mockar 4 deps
3. **Side effects ocultos**: difícil saber o que acontece quando mensagem é enviada
4. **Refactor arriscado**: adicionar novo side effect = modificar use-case

## Decisão

**Domain Events Bus** para desacoplar use-cases.

```typescript
// packages/domain/src/events/message-sent.event.ts
import { z } from 'zod';

export const MessageSentEventSchema = z.object({
  type: z.literal('message.sent'),
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  agentId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  attachments: z.array(z.string()).default([]),
  timestamp: z.coerce.date(),
});

export class MessageSentEvent {
  static readonly TYPE = 'message.sent' as const;

  constructor(
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly agentId: string,
    public readonly userId: string,
    public readonly content: string,
    public readonly attachments: string[] = []
  ) {}

  toJSON() {
    return {
      type: MessageSentEvent.TYPE,
      sessionId: this.sessionId,
      messageId: this.messageId,
      agentId: this.agentId,
      userId: this.userId,
      content: this.content,
      attachments: this.attachments,
      timestamp: new Date(),
    };
  }
}
```

```typescript
// packages/domain/src/events/event-bus.ts
export interface DomainEvent {
  readonly type: string;
  readonly timestamp: Date;
}

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void | Promise<void>
  ): () => void; // returns unsubscribe function
  subscribeAll(handler: (event: DomainEvent) => void | Promise<void>): () => void;
}
```

```typescript
// packages/infra/src/events/in-process-event-bus.ts
export class InProcessEventBus implements EventBus {
  private handlers = new Map<string, Set<Function>>();
  private globalHandlers = new Set<Function>();

  publish(event: DomainEvent): void {
    // Specific handlers
    const specific = this.handlers.get(event.type);
    if (specific) {
      specific.forEach((h) => {
        try {
          const result = h(event);
          if (result instanceof Promise) {
            result.catch((err) => logger.error({ err, event }, 'event handler failed'));
          }
        } catch (err) {
          logger.error({ err, event }, 'event handler threw');
        }
      });
    }

    // Global handlers
    this.globalHandlers.forEach((h) => {
      try {
        const result = h(event);
        if (result instanceof Promise) {
          result.catch((err) => logger.error({ err, event }, 'global event handler failed'));
        }
      } catch (err) {
        logger.error({ err, event }, 'global event handler threw');
      }
    });
  }

  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void | Promise<void>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  subscribeAll(handler: (event: DomainEvent) => void | Promise<void>): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }
}
```

### SendMessage Refatorado

```typescript
// packages/use-cases/src/chat/send-message.ts
export class SendMessage {
  constructor(
    private agentRepo: AgentRepo,
    private sessionRepo: SessionRepo,
    private messageRepo: MessageRepo,
    private providers: AIProviderFactory,
    private events: EventBus // ← Apenas EventBus, não conhece handlers
  ) {}

  async *execute(input: SendMessageInput): AsyncIterable<StreamChunk> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new AgentNotFoundError(input.agentId);

    const session = await this.sessionRepo.getOrCreate(input.sessionId, agent);
    const userMessage = Message.createUser(input.content, input.attachments);

    await this.messageRepo.save(session.id, userMessage);

    // ← Publica evento (não conhece side effects)
    this.events.publish(
      new MessageSentEvent(
        session.id,
        userMessage.id,
        agent.id,
        session.userId,
        input.content,
        input.attachments ?? []
      )
    );

    const provider = this.providers.forRuntime(agent.runtime);

    for await (const chunk of provider.query(agent.buildPrompt(session, userMessage))) {
      yield chunk;
    }
  }
}
```

### Handlers Subscrevem

```typescript
// apps/worker/src/event-handlers/title-generation.handler.ts
export class TitleGenerationHandler {
  constructor(
    private sessionRepo: SessionRepo,
    private titleGenerator: TitleGenerator
  ) {}

  register(bus: EventBus): () => void {
    return bus.subscribe('message.sent', async (event: MessageSentEvent) => {
      const session = await this.sessionRepo.findById(event.sessionId);
      if (session && !session.title) {
        const title = await this.titleGenerator.generate(session);
        await this.sessionRepo.update(session.id, { title });
      }
    });
  }
}

// apps/worker/src/event-handlers/usage-tracking.handler.ts
export class UsageTrackingHandler {
  constructor(private usageRepo: UsageRepo) {}

  register(bus: EventBus): () => void {
    return bus.subscribe('message.sent', async (event: MessageSentEvent) => {
      // Debounced usage tracking
      debounce(
        `usage-${event.sessionId}`,
        () => {
          this.usageRepo.trackMessage(event.userId, event.agentId, event.content.length);
        },
        5000
      );
    });
  }
}
```

```typescript
// apps/worker/src/index.ts (boot)
const bus = container.get(EventBus);

// Register all handlers
container.get(TitleGenerationHandler).register(bus);
container.get(UsageTrackingHandler).register(bus);
container.get(CompactionCheckHandler).register(bus);
container.get(MemoryUpdateHandler).register(bus);
```

## Consequências

### Positivas

- **Desacoplamento**: SendMessage não conhece handlers
- **Testabilidade**: testar SendMessage = mockar apenas EventBus
- **Side effects visíveis**: list de subscribers = documentação viva
- **Extensibilidade**: novo side effect = subscribe, não modificar use-case
- **Open/Closed Principle**: use-cases abertos para extensão, fechados para modificação
- **Audit trail**: events publicados podem ser logados

### Negativas

- **Indirection**: debug fica mais difícil (call chain quebrado)
- **Async hazards**: handlers async podem falhar silenciosamente
- **Memory leaks**: subscribers não removidos vazam
- **Testes integration**: testar handlers + event bus

### Mitigações

- Logger em todos os handlers (success + failure)
- Unmount cleanup (handler retorna `unsubscribe`)
- Integration tests para event flow

## Eventos do Wolfkrow

| Event                      | Quando              | Handlers                                     |
| -------------------------- | ------------------- | -------------------------------------------- |
| `message.sent`             | User envia mensagem | TitleGeneration, UsageTracking, MemoryUpdate |
| `message.received`         | Assistant responde  | CompactionCheck, UsageTracking               |
| `agent.created`            | Agent criado        | Logging, DefaultSettings                     |
| `agent.deleted`            | Agent deletado      | CascadeDelete                                |
| `document.ingested`        | Doc processado      | IndexUpdate, Notification                    |
| `pipeline.phase.started`   | Phase inicia        | Metrics, Logging                             |
| `pipeline.phase.completed` | Phase completa      | NextPhase, Metrics                           |
| `harness.round.completed`  | Round completa      | Evaluator, Metrics                           |
| `secret.accessed`          | Secret lido         | AuditLog                                     |
| `task.scheduled`           | Cron task agendada  | SchedulerEngine                              |

## Alternativas Consideradas

### A. Chamadas diretas (status quo)

**Prós**: Simples, óbvio
**Contras**: Acoplamento, testes frágeis
**Decisão**: ❌ Rejeitado

### B. Message Queue (RabbitMQ, Redis)

**Prós**: Distributed, persistent
**Contras**: Overhead para single-process
**Decisão**: ❌ Rejeitado — overkill

### C. Observer Pattern (built-in EventEmitter)

**Prós**: Node.js nativo
**Contras**: Sem type safety, memory leaks comuns
**Decisão**: 🤔 Aceitável, mas custom interface é mais type-safe

### D. CQRS + Event Sourcing

**Prós**: Audit completo, replay
**Contras**: Complexidade alta, não é nosso caso
**Decisão**: ❌ Rejeitado

## References

- [Domain Events (Martin Fowler)](https://martinfowler.com/eaaC/DomainEvent.html)
- [Event-Driven Architecture](https://microservices.io/patterns/data/event-driven-architecture.html)
- [Node.js EventEmitter](https://nodejs.org/api/events.html)
