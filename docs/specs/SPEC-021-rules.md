# SPEC-021: Rules (Global Editable Rules)

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Web
**Prioridade**: P1
**Origem LionClaw**: Rules page + injeção no prompt-builder, `.lionclaw/MEMORY.md`/`SOUL.md`/`USER.md`
**Fase do plano**: S.3

> ⚠️ **Gap crítico**: esta feature estava **PERDIDA** no plano v1 (não constava em PRD, app router nem migração de páginas). Reincluída aqui.

---

## 1. Visão Geral

Rules globais editáveis pelo user, injetadas em todo prompt (comportamento, tom, restrições). Equivalente ao `MEMORY.md`/`SOUL.md`/`USER.md` do LionClaw, agora editável via UI.

### User Stories

- US-1: Definir regra global "sempre responder em português".
- US-2: Definir persona/tom do assistant (SOUL).
- US-3: Definir contexto do user (USER) reutilizado em toda sessão.

---

## 2. Domain

```typescript
// packages/domain/src/entities/global-rule.ts
export type RuleKind = 'behavior' | 'soul' | 'user' | 'custom';

export class GlobalRule {
  static create(input: {
    kind: RuleKind;
    title: string;
    body: string;
    enabled?: boolean;
  }): GlobalRule {
    /* ... */
  }
  toPromptSection(): string {
    return `## ${this.title}\n${this.body}`;
  }
}
```

`PromptBuilder` (domain service) concatena rules `enabled` no system prompt — ordem determinística por `kind`.

---

## 3. Use-cases

```
CreateRule · UpdateRule · DeleteRule · ListRules · ToggleRule
BuildSystemPrompt (agent + skills + rules → prompt final)
```

`BuildSystemPrompt` é usado por chat, harness, pipeline, scheduler — **single source** da composição de prompt (DRY).

---

## 4. UI

- `rules/page.tsx`: lista por `kind`, editor markdown por regra, toggle enabled, preview do prompt final composto.

---

## 5. Testes

- `GlobalRule.toPromptSection`, ordenação determinística.
- `BuildSystemPrompt`: combina agent+skills+rules, ignora disabled (≥95%).
- Component editor + toggle ≥70%.

---

## 6. Gap fechado

Feature ausente no plano v1 agora rastreada (FEATURE_MATRIX #28). `BuildSystemPrompt` centraliza composição usada por 4 features — elimina duplicação de prompt-building.
