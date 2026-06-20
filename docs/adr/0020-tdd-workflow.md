# ADR-0020: TDD Obrigatório (RED → GREEN → REFACTOR)

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 tem 158 testes cobrindo ~5% do código (apenas adapters, sem testes de use-cases ou UI). Problemas:

1. **Cobertura insuficiente**: bugs em runtime
2. **Sem testes de use-cases**: lógica de negócio não testada
3. **Sem testes de UI**: regressões visuais
4. **Sem testes E2E**: fluxos críticos quebram sem aviso
5. **Refactor arriscado**: medo de quebrar o que funciona

## Decisão

**TDD obrigatório** para todas features. Workflow: **RED → GREEN → REFACTOR**.

### Processo por Feature

1. **Spec**: Criar `docs/specs/SPEC-XXX.md` antes de código
2. **RED**: Escrever testes que falham
3. **GREEN**: Implementar mínimo para passar
4. **REFACTOR**: Melhorar código sem quebrar testes
5. **REVIEW**: PR com coverage check

### Coverage Targets por Camada

| Camada | Target | Razão |
|---|---|---|
| `packages/domain/` | ≥95% | Pure logic, fácil testar |
| `packages/use-cases/` | ≥90% | Application logic crítica |
| `packages/infra/repos/` | ≥85% | Drizzle adapters |
| `packages/infra/ai-providers/` | ≥85% | AI providers |
| `apps/web/components/` | ≥70% | UI components |
| `apps/web/components/forms/` | ≥80% | Forms (alta interação) |
| `apps/web/components/auth/` | ≥80% | Security-critical |
| `apps/web/components/payment/` | ≥80% | Money-related |
| `apps/worker/` | ≥85% | Background tasks |

### Pirâmide de Testes

```
        ┌──────────────────┐
        │   E2E (50)       │  Playwright
        │   ~5% cobertura  │  Fluxos críticos
        ├──────────────────┤
        │  Integration (80)│  Vitest + SQLite in-memory
        │   ~15% cobertura │  DB + APIs
        ├──────────────────┤
        │ Component (200)  │  Testing Library
        │   ~25% cobertura │  UI isolada
        ├──────────────────┤
        │    Unit (400)    │  Vitest
        │   ~55% cobertura │  Pure logic
        └──────────────────┘
```

### Total Target: 730+ testes

## Workflow TDD

### 1. RED — Escrever Teste que Falha

```typescript
// packages/use-cases/src/__tests__/chat/send-message.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SendMessage } from '../chat/send-message';
import { AgentNotFoundError } from '@wolfkrow/domain/errors/agent-not-found-error';

describe('SendMessage', () => {
  it('throws AgentNotFoundError when agent does not exist', async () => {
    const mockAgentRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    
    const useCase = new SendMessage(
      mockAgentRepo as any,
      // ...
    );
    
    await expect(useCase.execute({
      agentId: 'non-existent',
      content: 'Hello',
    })).rejects.toThrow(AgentNotFoundError);
  });
});
```

### 2. GREEN — Implementar Mínimo

```typescript
// packages/use-cases/src/chat/send-message.ts
export class SendMessage {
  constructor(private agentRepo: AgentRepo, /* ... */) {}
  
  async execute(input: SendMessageInput): AsyncIterable<StreamChunk> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new AgentNotFoundError(input.agentId);
    // ... minimal impl
  }
}
```

### 3. REFACTOR — Melhorar

```typescript
// Extract magic strings, add proper error handling, etc
export class SendMessage {
  constructor(
    private agentRepo: AgentRepo,
    private sessionRepo: SessionRepo,
    private messageRepo: MessageRepo,
    private providers: AIProviderFactory,
    private events: EventBus,
  ) {}
  
  async *execute(input: SendMessageInput): AsyncIterable<StreamChunk> {
    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) throw new AgentNotFoundError(input.agentId);
    
    const session = await this.sessionRepo.getOrCreate(input.sessionId, agent);
    const userMessage = Message.createUser(input.content, input.attachments);
    
    await this.messageRepo.save(session.id, userMessage);
    this.events.publish(new MessageSentEvent(session.id, userMessage.id));
    
    const provider = this.providers.forRuntime(agent.runtime);
    
    for await (const chunk of provider.query(agent.buildPrompt(session, userMessage))) {
      yield chunk;
    }
  }
}
```

## Estrutura de Testes

```
src/
├── __tests__/
│   ├── unit/                  # Pure logic
│   ├── integration/          # DB + APIs
│   └── e2e/                  # Playwright
├── entities/
│   └── __tests__/
│       └── agent.test.ts
└── use-cases/
    └── __tests__/
        └── send-message.test.ts
```

## Consequências

### Positivas

- **Cobertura alta**: bugs detectados cedo
- **Refactor seguro**: testes garantem nada quebra
- **Documentação viva**: testes mostram como usar APIs
- **Confiança**: menos medo de mudar código
- **Design melhor**: TDD força APIs testáveis

### Negativas

- **Tempo inicial**: +30-50% tempo de desenvolvimento
- **Curva de aprendizado**: devs precisam aprender TDD
- **Over-testing**: risco de testar implementation details

### Mitigações

- Treinamento em TDD para time
- Code review focado em design de testes
- Métricas de coverage em CI
- "Test behavior, not implementation" como guideline

## CI Enforcement

```yaml
# .github/workflows/ci.yml
- name: Test with coverage
  run: pnpm test:cov

- name: Upload coverage
  uses: codecov/codecov-action@v3

- name: Check coverage thresholds
  run: |
    pnpm test:cov --coverage.thresholds.lines=85
    pnpm test:cov --coverage.thresholds.functions=85
    pnpm test:cov --coverage.thresholds.branches=80
    pnpm test:cov --coverage.thresholds.statements=85
```

## Definition of Done (atualizado)

Para uma feature ser "Done":

- [ ] Spec escrita
- [ ] Testes escritos ANTES (TDD) e passando
- [ ] Coverage targets atingidos por camada
- [ ] Implementação completa (sem TODOs)
- [ ] TypeScript strict passa
- [ ] ESLint + Prettier passam
- [ ] Manual testing (Chrome/Edge/Firefox)
- [ ] Documentation atualizada
- [ ] ADR criado (se decisão arquitetural)
- [ ] PR reviewed
- [ ] CI green

## Alternativas Consideradas

### A. Test after (status quo)

**Prós**: Mais rápido inicialmente
**Contras**: Coverage baixa, bugs em runtime
**Decisão**: ❌ Rejeitado

### B. BDD (Cucumber/Gherkin)

**Prós**: Especificação executável
**Contras**: Overhead, dupla manutenção
**Decisão**: ❌ Rejeitado

### C. Property-based testing (fast-check)

**Prós**: Edge cases descobertos
**Contras**: Curva de aprendizado
**Decisão**: ✅ Complementar (para domain entities)

### D. Snapshot testing (Jest)

**Prós**: Detecta mudanças não intencionais
**Contras**: Falso positivos
**Decisão**: 🤔 Usar com cuidado (Visual regression via Playwright)

## References

- [TDD by Example (Kent Beck)](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Codecov](https://about.codecov.io/)
