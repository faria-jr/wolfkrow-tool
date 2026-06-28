# ADR-0002: Monorepo com Turborepo + pnpm Workspaces

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O projeto tem 4 apps distintas (web, worker, sidecar, wrapper) + 8 packages compartilhados (shared-types, domain, use-cases, infra, ipc-contract, design-tokens, mcp-servers). Precisamos:

1. Compartilhar código entre apps sem duplicação
2. Garantir type safety end-to-end
3. Builds incrementais rápidos
4. Versionamento consistente
5. CI/CD eficiente

## Decisão

**Turborepo + pnpm workspaces** como sistema de monorepo.

Estrutura:

```
wolfkrow-tool/
├── apps/
│   ├── web/            # Next.js 15
│   ├── worker/         # Node.js Worker
│   ├── sidecar/        # Open Design (Next.js standalone)
│   └── wrapper/        # Electron
├── packages/
│   ├── shared-types/   # Zod schemas
│   ├── domain/         # Entities
│   ├── use-cases/      # Application services
│   ├── infra/          # DB, repos, providers
│   ├── ipc-contract/   # Type-safe Web ↔ Worker
│   ├── design-tokens/  # Tokens compartilhados
│   └── mcp-servers/    # 19 MCP packages
├── turbo.json
└── pnpm-workspace.yaml
```

## Consequências

### Positivas

- **Build incremental**: Turborepo cache (local + remote Vercel)
- **Dependency hoisting**: pnpm efficiently shares `node_modules`
- **Type-safe sharing**: packages importam direto (paths aliases `@wolfkrow/*`)
- **Parallel builds**: Turborepo detecta independent packages
- **CI speed**: 5min → 30s com cache
- **Workspace scripts**: `pnpm -r run build` roda tudo
- **Filter support**: `pnpm --filter web dev` roda só web

### Negativas

- **Lock file complexity**: `pnpm-lock.yaml` é compartilhado
- **Versioning**: mudanças em packages podem quebrar apps (mitigado por CI)
- **Onboarding**: novos devs precisam entender monorepo

### Mitigações

- Conventional commits + changesets para versionamento
- CI em todo PR detecta quebras
- Documentação em `AGENT.md`

## Alternativas Consideradas

### A. Nx

**Prós**: Mais features (generators, graph viz, etc), Task runner built-in
**Contras**: Mais complexo, mais opinionated, curva de aprendizado maior
**Decisão**: ❌ Rejeitado — Turborepo é mais leve e suficiente

### B. Lerna

**Prós**: Pioneiro em monorepos JS
**Contras**: Mais lento, menos features, mantido em modo manutenção
**Decisão**: ❌ Rejeitado — Nx ou Turborepo são superiores

### C. Yarn Workspaces

**Prós**: Maturidade, classic yarn é familiar
**Contras**: Yarn berry/PnP tem compatibilidade issues com Electron, Vite, Next.js
**Decisão**: ❌ Rejeitado — pnpm é mais compatível e eficiente

### D. Polyrepo (separado)

**Prós**: Simplicidade per-repo
**Contras**: Code sharing via npm packages é lento, versioning hell
**Decisão**: ❌ Rejeitado — quebra o type safety end-to-end

## Configuração

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/mcp-servers/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.base.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Referências

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Monorepo.tools](https://monorepo.tools/)
