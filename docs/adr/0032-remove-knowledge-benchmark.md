# ADR 0032: Remove Knowledge Benchmark from v1.0

## Status

Accepted · 2026-06-24

## Context

O Wolfkrow PRD (SPEC-004) originalmente incluía um **knowledge benchmark** — uma suíte de avaliação automática de retrieval para medir qualidade das buscas na knowledge base (recall@k, MRR, NDCG).

Durante a implementação da knowledge engine (FIX-002, FIX-031), identificamos que:

1. **Escopo de desenvolvimento vs. produto**: Um benchmark de retrieval é uma ferramenta de desenvolvimento/CI, não uma feature de produto para o usuário final. Usuários não interagem diretamente com métricas de recall@k.

2. **Dependências de dataset**: Um benchmark útil requer um dataset de ground truth (pares query→document esperado) específico ao domínio do usuário. Sem domínio fixo, o benchmark seria genérico demais para ser acionável.

3. **Custo de manutenção**: Manter um benchmark preciso exige atualização contínua conforme o corpus de knowledge evolui. Isso é trabalho de engenharia contínua sem ROI claro para v1.0.

4. **Alternativa suficiente**: A knowledge engine usa keyword LIKE + cosine similarity JS (`O(n)`) com planos de upgrade para sqlite-vec vec0 (documentado em ADR-0028). O recall subjetivo do usuário é suficiente para validar a abordagem em v1.0.

## Decision

Remover o knowledge benchmark de v1.0. A feature está marcada como `⛔ removida intencionalmente` na FEATURE_MATRIX (FIX-031).

## Consequences

**Positivo:**

- Reduz escopo de v1.0 em ~2 semanas de trabalho de engenharia.
- Evita complexidade de manter datasets de ground truth.
- Foco em features de produto com valor direto ao usuário.

**Negativo:**

- Sem métrica objetiva de qualidade de retrieval para CI.
- Degradações de recall só serão detectadas por feedback subjetivo do usuário.

## Mitigação

- O upgrade para sqlite-vec vec0 (ADR-0028) melhorará o recall de forma objetiva via embeddings.
- O benchmark pode ser adicionado como dev-tool em v1.1 (sem exposição no produto) quando houver dataset de ground truth coletado de uso real.

## Roadmap

- **v1.0**: Knowledge engine com LIKE + cosine similarity JS; sem benchmark.
- **v1.1**: Considerar retrieval eval como dev-tool interno (não exposto no produto).
- **v2.0**: sqlite-vec vec0 + voyage embeddings (ADR-0028) com métrica de recall automática em CI.
