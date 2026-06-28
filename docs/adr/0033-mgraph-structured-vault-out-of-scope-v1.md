# ADR 0033: Structured mgraph vault (ROAM-like) is out of scope for v1.0

## Status

Accepted · 2026-06-25

## Context

O LionClaw v1.0 implementava um **vault estruturado ROAM-like** no módulo
`electron/main/mgraph-engine.ts` (referência:
`/Users/juniorfaria/projects/lionclawv1.0/electron/main/mgraph-engine.ts`).
Esse engine tratava cinco tipos de nó como first-class citizens do vault:

1. **Entities** — pessoas, organizações, conceitos.
2. **Meetings** — reuniões com participantes, agenda e decisões associadas.
3. **Decisions** — decisões registradas com contexto, rationale e status.
4. **Projects** — iniciativas com escopo, milestones e links.
5. **References** — fontes externas (URLs, docs, papers) citáveis.

Cada nó tinha schema próprio, relações tipadas entre si e uma camada de UI
dedicada para CRUD + navegação bidirecional (backlinks). O modelo era
inspirado em ferramentas como Roam Research / Obsidian Bases.

Durante a migração para o Wolfkrow, o módulo `mgraph-engine.ts` **não foi
portado**. O Wolfkrow em v1.0 oferece:

- **Graph view** — visualização interativa em D3 com extração automática de
  entidades a partir do conteúdo (chat, notas, artifacts).
- **MCP Graph search** — binário real (FEATURE_MATRIX row 55) que permite
  busca programática nas relações extraídas.

Ou seja: o Wolfkrow cobre o caso de uso de **visualização de relações**, mas
**não** adota os **tipos de nó estruturados** (entities/meetings/decisions/
projects/references como schemas first-class).

## Decision

**O vault estruturado ROAM-like (Decision B) fica explicitamente fora do
escopo do Wolfkrow v1.0.** Os tipos de nó estruturados não serão portados de
`mgraph-engine.ts`, nem introduzidos como schemas no `packages/domain/`.

A visualização de relações em v1.0 é coberta pela **graph view (D3 + entity
extraction)** e pelo **MCP Graph search**, que atendem ao caso de uso de
"enxergar relações entre conteúdo" sem exigir que o usuário mantenha um
schema estruturado manual.

Esta é uma decisão de produto intencional (não uma lacuna de implementação),
registrada para que o comportamento seja auditável e reversível.

## Rationale

### 1. Custo de schema vs. valor em v1.0

Um vault estruturado exige schemas tipados, migrations, UI de CRUD para cada
tipo de nó, validação de relações e regras de integridade referencial.
Estimativa conservadora: 2-3 semanas de engenharia (domain + infra + UI +
testes) para alcançar paridade mínima com o LionClaw.

### 2. Graph view cobre o caso de uso central

O usuário que migrava do LionClaw buscando "ver como as coisas se conectam"
tem essa necessidade atendida pela graph view D3, que é **automática**
(extração de entidades) em vez de **manual** (curadoria de nós tipados). Para
o público self-hosted do Wolfkrow (devs/researchers), a extração automática
tem ROI mais alto que a curadoria manual.

### 3. Manutenção de schemas tipados é contínua

Cada tipo de nó estruturado precisa de evolução de schema, migração de dados
existentes e suporte a backlinks bidirecionais. Sem uma base de usuários
pedindo isso explicitamente, o custo de manutenção supera o benefício.

### 4. Paridade não é meta do Wolfkrow

O Wolfkrow não busca paridade 1:1 com o LionClaw (ver ADR-0031, que deferiu
Higgsfield/Blotato pelo mesmo princípio). Features são portadas quando há
valor proporcional; o vault estruturado não atingiu esse limiar em v1.0.

## Alternatives Considered

1. **Decision A — Portar o vault estruturado (paridade LionClaw).**
   - Rejeitado para v1.0: ~2-3 semanas de trabalho sem demanda registrada,
     quando a graph view já cobre o caso de uso de visualização de relações.
   - **Critério de reversão:** se ≥ 3 usuários pedirem os tipos estruturados
     explicitamente, este ADR é revogado e a Decision A é adotada.

2. **Decision C — Stub parcial (apenas entities + references, sem
   meetings/decisions/projects).**
   - Rejeitado: um schema parcial cria inconsistência (metade dos tipos
     tipados, metade implícita) e não reduz proporcionalmente o custo de
     UI/migration. Ou se faz completo ou se mantém fora.

3. **Manter `mgraph-engine.ts` como referência não-portada sem ADR.**
   - Rejeitado: sem ADR, a omissão parece lacuna em vez de decisão. O ADR
     torna a intenção explícita e auditável.

## Consequences

### Positivas

- Escopo v1.0 fica focado na graph view (D3) + MCP Graph search, que cobrem
  visualização de relações com extração automática.
- Evita ~2-3 semanas de engenharia em schema/UI sem demanda registrada.
- Sem curadoria manual obrigatória — o usuário não precisa classificar nós
  para obter valor da visualização.
- Decisão transparente e reversível documentada em ADR.

### Negativas / Riscos

- Usuários vindos do LionClaw que dependiam dos tipos estruturados
  (especialmente meetings/decisions com integridade referencial) perdem essa
  capacidade. Mitigação: changelog e migration notes deixam claro que o vault
  estruturado é roadmap condicional (ver gatilho de reversão).
- A graph view com extração automática pode ser menos precisa que nós
  curados manualmente para casos de uso jurídico/auditoria.

## Migration Notes

- `packages/domain/`: nenhum schema de nó estruturado (entities/meetings/
  decisions/projects/references) será criado em v1.0.
- `docs/FEATURE_MATRIX.md`: adicionada entrada na seção "Funcionalidades
  descoped para v1.1+" registrando a decisão e referenciando este ADR.
- `docs/PRD.md`: o Wolfkrow descreve "graph view" (visualização automática),
  não "structured vault". Nenhuma menção a vault estruturado deve ser
  adicionada como feature de v1.0.
- `scripts/migrate-lionclaw.ts`: se detectar dados estruturados do
  `mgraph-engine.ts` no LionClaw de origem, emitir warning "vault estruturado
  ROAM-like não foi portado para Wolfkrow v1.0; a graph view cobre
  visualização de relações via extração automática. Tipos estruturados são
  roadmap condicional (ADR-0033)." Não é bloqueante.

## Trigger para reverter (revogar este ADR)

Reabrir este ADR (adotar Decision A — implementar) se:

1. ≥ 3 usuários pedirem os tipos estruturados (entities/meetings/decisions/
   projects/references) explicitamente no Wolfkrow.
2. OU um caso de uso de compliance/auditoria exigir integridade referencial
   tipada que a extração automática não consiga garantir.
3. OU a graph view D3 provar ser insuficiente para visualização de relações
   em > 50% dos fluxos de usuário reportados.

## Roadmap

- **v1.0**: Graph view (D3 + entity extraction) + MCP Graph search. Sem vault
  estruturado.
- **v1.1+**: Avaliar demanda real; se gatilho de reversão acionar, portar
  tipos estruturados de forma incremental (começando por entities +
  references).
