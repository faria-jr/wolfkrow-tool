# ADR-0035: Skills override — fork built-in into user-scoped copy (preserve base)

**Status**: ✅ Aceito (2026-06-27)
**Data**: 2026-06-27

## Contexto

Skills built-in (`userId='system'`, `isBuiltIn=true`) eram editadas **in-place**:
o `PUT /api/skills/:id` rodava `UpdateSkillUseCase` sobre a linha base, mutando-a
para todos. Em modo workspace compartilhado isso "funciona" (todos veem a editada),
mas viola o princípio de preservar a fonte original — um edit não pode ser
desfeito sem saber o conteúdo base, e overrides de diferentes operadores se
pisoteiam.

O `ListSkillsUseCase` já deduplica por `name` preferindo a cópia do usuário sobre
a built-in (`map.set(c.name, c)`), então a base para um mecanismo de override já
existia.

## Decisão

Editar uma skill built-in **cria uma cópia user-scoped** (fork) em vez de mutar a
base. Implementado em `OverrideSkillUseCase`:

- Skill do próprio usuário ou custom → update in-place (sem fork).
- Skill built-in (outro owner) → `Skill.create` com `userId` do operador, mesmo
  `name`, `isBuiltIn=false`. A linha base fica intacta.
- O `ListSkillsUseCase` já mostra o fork no lugar da base (mesmo name, prefere
  cópia do usuário). Deletar o fork faz a base voltar a aparecer.

Nenhuma coluna nova nem migration: o fork é só outra linha com `isBuiltIn=false`.

## Consequências

### Positivas

- Base original sempre preservada; override é reversível (delete o fork).
- Múltiplos operadores podem ter overrides independentes (quando ownership por
  usuário for reativada).
- Reutiliza o dedup existente — sem mudança no `ListSkillsUseCase`.

### Negativas / riscos

- Não há flag explícito `isOverride` na entidade (o fork é só `isBuiltIn=false`
  com mesmo name). A UI não consegue distinguir "fork de built-in" de "skill
  custom que coincide no name". Mitigação: aceitável no MVP; se necessário, adicionar
  `metadata.overridesBuiltIn` numa evolução.

## Alternativas consideradas

- **Coluna `originId` + dedup por originId**: mais correto, mas exige migration
  + mudança no list. Rejeitado p/ MVP (refinamento futuro).
- **Manter mutação in-place**: rejeitado — perde a fonte original.

## Referências

- `packages/use-cases/src/skills/override-skill.ts`
- `apps/web/app/api/skills/[id]/route.ts` (PUT usa `OverrideSkillUseCase`)
- `packages/use-cases/src/skills/list-skills.ts` (dedup por name)
- Fase 5 do `docs/mvp_final_plan.md`
