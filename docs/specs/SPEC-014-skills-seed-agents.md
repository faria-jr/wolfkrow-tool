# SPEC-014: Skills + Seed-Agents (YAML)

**Status**: 📝 Draft
**Camada**: Domain + Use-cases + Worker (loader) + Web
**Prioridade**: P1
**Origem LionClaw**: `electron/main/skills.ts`, `seed-agents/` (67 arquivos `.ts`, 9610 linhas), `mcp-servers/skills/`
**Fase do plano**: N.2

---

## 1. Visão Geral

Duas partes:

1. **Skills**: arquivos Markdown com frontmatter que adicionam capability/context ao agent. CRUD + attach a agents.
2. **Seed-agents**: migrar 67 agents `.ts` (9610 linhas) → `.wolfkrow/agents/*.yaml` com **loader único + validator Zod** (DRY, −80% linhas).

### User Stories

- US-1: Criar skill "pdf-processing" com instruções.
- US-2: Ativar/desativar skill por agent.
- US-3: Distribuir agents pré-configurados (seed) sem hardcode em `.ts`.

---

## 2. Domain

```typescript
// packages/domain/src/entities/skill.ts
export class Skill {
  static fromMarkdown(raw: string): Skill {
    const { frontmatter, body } = parseFrontmatter(raw);
    const meta = SkillFrontmatterSchema.parse(frontmatter); // Zod
    return new Skill({ ...meta, body });
  }
}
```

Frontmatter Zod: `name`, `description`, `tags?`, `builtin: boolean`.

---

## 3. Seed-agents loader (Worker)

```typescript
// apps/worker/src/seed-agents/loader.ts
export async function loadSeedAgents(dir: string): Promise<SeedAgent[]> {
  const files = await glob(`${dir}/*.yaml`);
  return Promise.all(files.map(async (f) => SeedAgentSchema.parse(parseYaml(await read(f)))));
}
```

- `schema.ts`: Zod do YAML (mesmos campos do Agent + `systemPrompt` multiline).
- `validator.ts`: valida + smoke (carrega, instancia prompt).
- Script `pnpm seed:agents`: converte os 67 `.ts` → YAML uma vez.

---

## 4. Use-cases

```
CreateSkill · UpdateSkill · DeleteSkill · ListSkills · AttachSkillToAgent · DetachSkillFromAgent
SeedAgents (idempotente: carrega YAML → upsert no DB)
```

---

## 5. UI

- `skills/page.tsx` (RSC lista) + `SkillEditor` (Textarea + Tabs preview markdown + frontmatter form).
- Skills bundled (builtin, read-only) vs custom (editável).

---

## 6. Testes

- Domain: `fromMarkdown` (frontmatter válido/inválido) ≥95%.
- Loader: parse YAML, validação, smoke por agent (67 smoke tests).
- Use-cases ≥90%. Component editor ≥70%.

---

## 7. Métrica de sucesso

67 agents convertidos, total de linhas −80% (9610 → ~2000 YAML), todos passam smoke.
