# SPEC-013: Sub-Agents (Custom AI Personas)

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Web
**Prioridade**: P0 (core)
**Origem LionClaw**: `electron/main/agent-config-resolver.ts`, `agent-sync.ts`, `seed-agents/`, `src/components/agents/AgentFormModal.tsx` (1765 linhas)
**Fase do plano**: N.1

---

## 1. Visão Geral

CRUD de agents especializados: system prompt, tools permitidas, modelo, effort, thinking, maxTurns, skills, MCPs, squad e runtime. Sync em massa alinha todos os agents ao orquestrador escolhido.

### User Stories

- US-1: Criar agent "code-reviewer" que só lê código e comenta.
- US-2: Duplicar agent existente e customizar.
- US-3: Sincronizar todos os agents ao SDK selecionado (sync em massa).

---

## 2. Domain

```typescript
// packages/domain/src/entities/agent.ts
export type Runtime = 'cloud' | 'local' | 'codex' | 'external';
export type Squad = 'harness' | 'workflow' | 'enrich' | 'custom';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export class Agent {
  private constructor(private props: AgentProps) {}

  static create(input: CreateAgentInput): Agent {
    if (!input.name.trim()) throw new ValidationError('name required');
    if (input.maxTurns < 1) throw new ValidationError('maxTurns >= 1');
    return new Agent({ ...input, id: Id.generate() });
  }

  buildPrompt(context: PromptContext): Prompt {
    /* compose system + skills + rules */
  }
  duplicate(newName: string): Agent {
    return Agent.create({ ...this.props, name: newName });
  }
}
```

Ports: `AgentRepo extends Repo<Agent>`. Não conhece Drizzle.

---

## 3. Use-cases

```
CreateAgent · UpdateAgent · DeleteAgent · DuplicateAgent · ListAgents · SyncAgentsToOrchestrator
```

`SyncAgentsToOrchestrator`: lê orquestrador atual, calcula diff (model/runtime), aplica em batch, grava `agent_sync_history`, publica `AgentsSyncedEvent`.

---

## 4. UI (shadcn)

- `agents/page.tsx` (RSC: lista) → `AgentList` (DataTable).
- `AgentFormModal` **refatorado**: LionClaw 1765 linhas → shadcn `Form` + react-hook-form + Zod `AgentSchema`, dividido em sub-componentes (`ModelSection`, `ToolsSection`, `ThinkingSection`, `SkillsSection`) — **cada ≤150 linhas, alvo total ≤300**.
- `SyncAgentsModal` (Dialog + DataTable diff), `DeleteAgentDialog` (AlertDialog).

---

## 5. Testes

- Domain: validação (name vazio, maxTurns), `buildPrompt`, `duplicate` (≥95%).
- Use-cases: cada CRUD + sync diff (≥90%).
- Component: `AgentFormModal` submit válido/inválido (≥70%).
- E2E `agents.spec.ts`: criar → editar → duplicar → sync → deletar.

---

## 6. Anti-god-class

`AgentFormModal` original (1765) **proibido**. Lint barra >300 linhas/arquivo e >50/função. Form quebrado em seções + hooks (`useAgentForm`).
