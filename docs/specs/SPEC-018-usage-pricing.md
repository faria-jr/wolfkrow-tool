# SPEC-018: Usage + Pricing Calculator

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Web
**Prioridade**: P2
**Origem LionClaw**: `electron/main/pricing.ts`, schema `token_usage`, `src/pages/UsagePage.tsx`
**Fase do plano**: S.2

---

## 1. Visão Geral

Analytics de custo de tokens por modelo/agent/período. PricingCalculator multi-fonte (anthropic/openai/vertex/custom). **Melhoria nova**: budget alerts por agent/período (O9).

### User Stories

- US-1: Ver quanto gastei em tokens esta semana.
- US-2: Comparar custo por agent.
- US-3: Alerta quando agent/período passa do budget.

---

## 2. Domain

```typescript
// packages/domain/src/services/pricing-calculator.ts
export class PricingCalculator {
  constructor(private table: PricingTable) {}

  cost(model: ModelId, usage: TokenUsage): Money {
    const tier = this.table.tierFor(model); // throws if unknown
    return Money.of(
      (tier.inputPer1k * usage.inputTokens) / 1000 + (tier.outputPer1k * usage.outputTokens) / 1000
    );
  }
}
```

VO: `PricingTier`, `Money`, `TokenUsage`. Tabela carregada de config (anthropic/openai/vertex/custom).

---

## 3. Use-cases

```
RecordUsage (grava token_usage por message/run) · ComputeUsage (agrega por filtro) · CheckBudget (alerta)
```

---

## 4. UI

- `usage/page.tsx` (RSC: agrega) + charts `recharts` (custo/dia, por modelo, por agent).
- `BudgetSettings`: definir budget por agent/período; badge de alerta quando excede.

---

## 5. Testes

- `PricingCalculator.cost` (cada fonte, modelo desconhecido → erro) ≥95%.
- `CheckBudget` (abaixo/no limite/acima).
- Component charts render com dados mock ≥70%.

---

## 6. Anti-métrica

Não otimizar para "menos tokens" — eficiência > economia (PRD §5.3). Usage é visibilidade, não gate.
