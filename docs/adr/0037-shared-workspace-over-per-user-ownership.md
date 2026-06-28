# ADR-0037: Shared workspace replaces per-user ownership (MVP default)

**Status**: ✅ Aceito (2026-06-27)
**Data**: 2026-06-27

## Contexto

O Lionclaw (referência de paridade) é uma ferramenta de **operador único /
desktop local**. O Wolfkrow herda esse perfil de produto: não é um SaaS
multi-tenant com isolamento por usuário — é o computador do operador, onde um
único conjunto de agentes/skills/projetos/provider-keys faz sentido.

Várias entidades (`HarnessProject`, `PipelineProject`, `Skill`, `ProviderConfig`)
tinham `userId` como chave de ownership, e os repos filtravam por ele. Em modo
operador único isso gera fricção: a sessão pode resolver `userId='anonymous'` ou
`'default'`, e cadastros feitos numa sessão "somem" para outra porque o filtro
`where userId = ?` exclui tudo. Era a classe de bug P0-7/P2-1 (default-user leak).

## Decisão

**Workspace compartilhado como default do MVP** (`WOLFKROW_SHARED_WORKSPACE=true`
em `apps/worker/src/config.ts`). Quando ativo:

- Rotas de listagem retornam **todos** os registros (`findAll()`) em vez de
  filtrar por `userId` (e.g. `listHarnessProjectsHandler`, `ListSkillsUseCase`
  com `builtinOnly`/system, `listRulesHandler`).
- Cadastros (create) ainda gravam `userId` para auditoria/autoria, mas a leitura
  é compartilhada.
- `OverrideSkillUseCase` (ADR-0035) preserva isso: o fork é user-scoped mas a
  leitura deduplica por name, então todos vêem o override.

`WOLFKROW_SHARED_WORKSPACE=false` reativa o filtro por `userId` (caminho
multi-usuário futuro) — o código mantém os dois ramos, então a transição é
reversível.

## Consequências

### Positivas

- Resolve a classe default-user leak: um operador vê todos os seus cadastros
  independente de como a sessão resolveu o userId.
- Alinha com o perfil desktop/operador-único do Lionclaw (paridade preservada).
- Reversível via flag — sem reescrever quando/quando multi-usuário for real.

### Negativas / riscos

- **Não é multi-tenant seguro**: se duas pessoas reais usarem a mesma instância,
  veem os dados uma da outra. Aceitável p/ MVP (produto não é SaaS); documentado.
- `userId` de auditoria pode ser `'anonymous'`/`'default'` — autoria imprecisa.
  Mitigação: rotas críticas (auth, audit log) ainda exigem sessão real.

## Alternativas consideradas

- **Forçar ownership estrito por userId desde o MVP**: rejeitado — quebra o
  perfil operador-único e reintroduz a classe default-user leak.
- **Remover `userId` das entidades**: rejeitado — perderia auditoria e o caminho
  multi-usuário futuro.

## Referências

- `apps/worker/src/config.ts` (`WOLFKROW_SHARED_WORKSPACE`)
- ADR-0035 (skills override depende deste modelo de leitura)
- Fase 10 do `docs/mvp_final_plan.md` (item "ADR se workspace compartilhado
  substituir ownership por usuário")
- `docs/MIGRATION_FROM_LIONCLAW.md` (perfil desktop/operador-único)
