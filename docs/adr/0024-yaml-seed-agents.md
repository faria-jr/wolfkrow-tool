# ADR-0024: YAML para Seed Agents

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 tem **67 seed agents como arquivos `.ts` separados** em `electron/main/seed-agents/`, totalizando **9.610 linhas**.

Cada arquivo tem estrutura similar:

```typescript
// electron/main/seed-agents/code-reviewer.ts
export const codeReviewer: AgentConfig = {
  id: 'code-reviewer',
  name: 'Code Reviewer',
  description: 'Reviews code changes',
  model: 'claude-sonnet-4-5',
  effort: 'high',
  thinking: true,
  thinkingBudget: 10000,
  maxTurns: 80,
  allowedTools: ['Read', 'Grep', 'Glob'],
  runtime: 'cloud',
  squad: 'harness',
  systemPrompt: `You are a senior code reviewer...`,
};
```

Problemas:
1. **Verboso**: 140 linhas por agent × 67 = 9.610 linhas
2. **Difícil de revisar**: PRs com diffs enormes
3. **Sem metadata rica**: YAML suporta mais (tags, examples, etc)
4. **Acoplado ao código**: editar agent = recompilar
5. **Sem versionamento semântico de prompts**: difícil A/B test

## Decisão

**YAML** como formato para seed agents, com loader Zod para validação.

### Estrutura

```yaml
# .wolfkrow/agents/code-reviewer.yaml
id: code-reviewer
name: Code Reviewer
description: Reviews code changes and provides constructive feedback
model: claude-sonnet-4-5
effort: high
thinking: true
thinkingBudget: 10000
maxTurns: 80
allowedTools:
  - Read
  - Grep
  - Glob
  - WebFetch
mcpServers: []
runtime: cloud
squad: harness
tags:
  - review
  - quality
  - security
examples:
  - input: "Review PR #123"
    output: "Analyzing 3 files changed..."
metadata:
  author: wolfkrow-labs
  version: 1.0.0
systemPrompt: |
  You are a senior code reviewer with 15 years of experience.
  
  Focus on:
  - Security vulnerabilities (OWASP Top 10)
  - Performance bottlenecks
  - Maintainability issues
  - Test coverage gaps
  
  Be constructive. Suggest improvements, don't just criticize.
  Use markdown for clarity.
  Cite specific files and line numbers.
```

### Loader

```typescript
// apps/worker/src/seed-agents/loader.ts
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import { AgentSchema } from '@wolfkrow/shared-types/schemas/agent';
import { z } from 'zod';

const AgentYamlSchema = AgentSchema.extend({
  tags: z.array(z.string()).default([]),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })).default([]),
  metadata: z.object({
    author: z.string().optional(),
    version: z.string().default('1.0.0'),
  }).default({}),
});

export type AgentYaml = z.infer<typeof AgentYamlSchema>;

export class SeedAgentsLoader {
  constructor(private agentsDir: string) {}
  
  async loadAll(): Promise<AgentYaml[]> {
    const files = await fs.readdir(this.agentsDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    return Promise.all(yamlFiles.map((f) => this.loadOne(f)));
  }
  
  async loadOne(filename: string): Promise<AgentYaml> {
    const filepath = path.join(this.agentsDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    const data = yaml.parse(content);
    
    // Validate with Zod (throws if invalid)
    return AgentYamlSchema.parse(data);
  }
  
  async save(agent: AgentYaml): Promise<void> {
    const filepath = path.join(this.agentsDir, `${agent.id}.yaml`);
    const content = yaml.stringify(agent);
    await fs.writeFile(filepath, content, 'utf-8');
  }
}
```

## Consequências

### Positivas

- **~80% menos linhas**: 9.610 → ~2.000 YAML
- **Versionável**: agents têm `metadata.version`
- **Metadata rica**: tags, examples, author
- **Validado**: Zod garante schema consistente
- **Editável sem recompilar**: muda prompt sem build
- **Diff-friendly**: PRs pequenos e claros
- **Compartilhável**: fácil copiar agent entre projetos

### Negativas

- **YAML parsing**: overhead leve (yaml lib)
- **Sem type safety em IDE**: precisa plugin YAML + schema
- **No syntax errors visíveis**: erros só em runtime (mas Zod pega)

### Mitigações

- **YAML Language Server** + JSON schema = IntelliSense
- Validação Zod em boot (fail-fast)
- Tests de validação (schema aceita e rejeita corretamente)

## Migração

### Script de Conversão

```typescript
// scripts/migrate-seed-agents.ts
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';

const sourceDir = 'electron/main/seed-agents';
const targetDir = '.wolfkrow/agents';

const files = await fs.readdir(sourceDir);
const tsFiles = files.filter((f) => f.endsWith('.ts'));

for (const file of tsFiles) {
  const module = await import(path.join(sourceDir, file));
  const agent = Object.values(module)[0] as any;
  
  const yamlContent = yaml.stringify({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    effort: agent.effort,
    thinking: agent.thinking,
    thinkingBudget: agent.thinkingBudget,
    maxTurns: agent.maxTurns,
    allowedTools: agent.allowedTools,
    mcpServers: agent.mcpServers ?? [],
    runtime: agent.runtime,
    squad: agent.squad,
    systemPrompt: agent.systemPrompt,
  });
  
  await fs.writeFile(path.join(targetDir, `${agent.id}.yaml`), yamlContent);
  console.log(`Migrated ${agent.id}`);
}
```

## Organização

```
.wolfkrow/
├── agents/
│   ├── built-in/
│   │   ├── code-reviewer.yaml
│   │   ├── debugger.yaml
│   │   ├── security-auditor.yaml
│   │   ├── frontend-developer.yaml
│   │   ├── backend-developer.yaml
│   │   └── ... (67 agents)
│   └── user/
│       └── my-custom-agent.yaml  # user-created
├── skills/
│   └── built-in/
│       └── ... (14 skills)
└── workflows/
    └── build-plan/
        └── stages/
            ├── discovery.md
            ├── spec-build.md
            └── ...
```

## Alternativas Consideradas

### A. JSON

**Prós**: Type-safe nativo
**Contras**: Sem comentários, sem multi-line strings naturais
**Decisão**: ❌ Rejeitado — YAML é melhor para prompts

### B. TOML

**Prós**: Simples, similar a INI
**Contras**: Menos familiar, sem multi-line strings
**Decisão**: ❌ Rejeitado

### C. Markdown + frontmatter

**Prós**: Prompt + metadata no mesmo arquivo
**Contras**: Menos estruturado para fields complexos
**Decisão**: 🤔 Considerado para v2.0 (prompts em MD puro + frontmatter mínimo)

### D. Manter .ts (status quo)

**Prós**: Type-safe, IDE support
**Contras**: Verboso, 9.610 linhas
**Decisão**: ❌ Rejeitado

## References

- [YAML Spec](https://yaml.org/spec/)
- [yaml npm package](https://www.npmjs.com/package/yaml)
- [Zod](https://zod.dev/)
- [YAML Language Server](https://github.com/redhat-developer/yaml-language-server)
