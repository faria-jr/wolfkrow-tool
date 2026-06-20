# ADR-0003: Clean Architecture com 4 Camadas Isoladas

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 tem problemas arquiteturais significativos:

- `db.ts` com 5598 linhas (god object)
- `ipc-handlers.ts` com 5190 linhas (god object)
- `orchestrator.ts` com 1178 linhas
- Acoplamento direto: UI → main → DB sem abstração
- Testes impossíveis sem mockar SQLite, Electron, Anthropic SDK
- Mudanças em 1 lugar quebram 5 outros

Precisamos de uma arquitetura que:
1. Isole regras de negócio de frameworks
2. Permita testes sem dependências externas
3. Facilite mudanças (ex: trocar SQLite por Postgres)
4. Aplique SOLID + DRY

## Decisão

**Clean Architecture** com 4 camadas isoladas, baseada no modelo do Uncle Bob.

```
┌─────────────────────────────────────────────┐
│  Presentation (apps/web + apps/wrapper)     │  ← Next.js + React
└──────────────────┬──────────────────────────┘
                   │ chama use-cases
┌──────────────────▼──────────────────────────┐
│  Application (packages/use-cases/)          │  ← Use cases + DI
└──────────────────┬──────────────────────────┘
                   │ orquestra entities
┌──────────────────▼──────────────────────────┐
│  Domain (packages/domain/)                  │  ← Entities + Services
│  Zero deps externas (puro TypeScript)       │
└──────────────────▲──────────────────────────┘
                   │ implementado por
┌──────────────────┴──────────────────────────┐
│  Infrastructure (packages/infra/)           │  ← DB, AI, External
│  apps/worker/                               │  ← Worker processes
└─────────────────────────────────────────────┘
```

### Regras de Dependência

- `domain/` → zero imports externos (exceto Zod leve)
- `use-cases/` → importa apenas `domain/`
- `infra/` → importa `domain/` + `use-cases/`
- `apps/*` → importa tudo (mas presentation não toca infra direto)

### Inversify (DI Container)

```typescript
// packages/use-cases/src/di/container.ts
import { Container } from 'inversify';

export const container = new Container();

container.bind<AgentRepo>('AgentRepo').to(DrizzleAgentRepo);
container.bind<AIProviderFactory>('AIProviderFactory').to(AIProviderFactoryImpl);
container.bind<CreateAgent>('CreateAgent').to(CreateAgent);
container.bind<SendMessage>('SendMessage').to(SendMessage);
// ...
```

## Consequências

### Positivas

- **Testabilidade**: domain testado sem mocks; use-cases com mocks de repo
- **Flexibilidade**: trocar SQLite por Postgres = criar novo adapter
- **Manutenibilidade**: cada camada tem responsabilidade clara
- **Onboarding**: novos devs entendem onde colocar código
- **SOLID**: Single Responsibility por camada, Dependency Inversion via interfaces

### Negativas

- **Mais arquivos**: 4 camadas = mais boilerplate
- **Curva de aprendizado**: devs precisam entender inversão de dependência
- **Overhead inicial**: mais tempo planejando antes de codar

### Mitigações

- Code generators (Plop ou Hygen) para scaffolding consistente
- Documentação clara em `AGENT.md`
- ADRs documentam decisões
- Exemplos em `docs/specs/`

## Alternativas Consideradas

### A. Hexagonal Architecture (Ports & Adapters)

**Prós**: Similar a Clean Arch, foca em ports explícitas
**Contras**: Menos知名, menos material didático
**Decisão**: ❌ Aceitável, mas Clean Arch é mais conhecido e suficiente

### B. DDD (Domain-Driven Design) full

**Prós**: Bom para domínios complexos com bounded contexts
**Contras**: Overhead enorme para nosso caso (single-user, single-domain)
**Decisão**: ❌ Rejeitado — overkill, vamos aplicar DDD tático (entities + value objects + events) sem DDD estratégico

### C. Layered Architecture tradicional (3 camadas)

**Prós**: Simples, familiar
**Contras**: Acoplamento entre camadas, god services
**Decisão**: ❌ Rejeitado — não resolve nossos problemas

### D. Microservices

**Prós**: Independência, scaling
**Contras**: Complexidade operacional, network overhead
**Decisão**: ❌ Rejeitado — single-user, single-machine, sem benefício

## Estrutura Detalhada

### `packages/domain/`
```
src/
├── entities/
│   ├── agent.ts
│   ├── session.ts
│   ├── message.ts
│   ├── knowledge/
│   │   ├── document.ts
│   │   └── chunk.ts
│   └── ...
├── value-objects/
│   ├── model-id.ts
│   ├── tool-name.ts
│   └── ...
├── services/
│   ├── pricing-calculator.ts
│   └── permission-resolver.ts
├── events/
│   └── ...
└── repos/                 # Interfaces only
    ├── agent-repo.ts
    └── ...
```

### `packages/use-cases/`
```
src/
├── chat/
│   ├── send-message.ts
│   └── compact-session.ts
├── agents/
│   ├── create-agent.ts
│   └── sync-to-orchestrator.ts
├── knowledge/
│   ├── ingest-document.ts
│   └── search-knowledge.ts
└── di/
    └── container.ts
```

### `packages/infra/`
```
src/
├── db/
│   ├── schema/            # Drizzle
│   ├── migrations/
│   └── client.ts
├── repos/                 # Drizzle implementations
├── ai-providers/          # Strategy pattern
├── embeddings/
├── secrets/               # keytar
└── external/              # Telegram, ElevenLabs, etc
```

### `apps/web/`
```
app/
├── (auth)/
├── (app)/                 # Authenticated
└── api/                   # Route Handlers
components/
lib/
└── presentation/          # Hooks, stores (Zustand)
```

## Referências

- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Clean Architecture in TypeScript](https://github.com/eduardomoroni/clean-architecture-typescript)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [InversifyJS](https://github.com/inversify/InversifyJS)
