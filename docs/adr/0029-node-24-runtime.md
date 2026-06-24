# ADR-0029: Node.js 24 como Runtime Oficial

## Status

Proposed → Accepted

## Contexto

Durante a auditoria de 2026-06-23 identificou-se que o projeto estava sendo desenvolvido e testado em ambientes com Node.js 22, enquanto o módulo nativo `better-sqlite3` havia sido compilado contra Node.js 24 (ABI 137). Isso causava falhas em 29 testes do pacote `@wolfkrow/infra` quando executados sem cache do Turborepo:

```
Error: The module ... better_sqlite3.node
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 127.
```

Além disso, o LionClaw v1.0 já recomendava Node 24+ para módulos nativos, e o Wolfkrow Tool utiliza:
- `better-sqlite3` (bindings nativos)
- `sqlite-vec` (extensão nativa de vetores)
- `keytar` (keychain nativo)
- `node-pty` (pseudo-terminal nativo)
- Electron 33 (que requer Node compatível)

A divergência de runtime criava fricção para novos contribuidores e risco de CI quebrar silenciosamente devido ao cache do Turborepo.

## Decisão

Padronizar o projeto para **Node.js 24+** como runtime oficial de desenvolvimento, CI/CD e produção.

### Consequências

- `.nvmrc` já estava em `24`; agora é efetivamente exigido.
- `engines.node` em todos os `package.json` passa para `>=24.0.0`.
- `@types/node` atualizado para `^24.0.0` em todos os workspaces.
- GitHub Actions (`ci.yml`, `nightly.yml`, `release.yml`) usam `node-version: 24`.
- Testes no CI rodam com `turbo test --force` para evitar que cache oculte falhas de ABI.
- Contribuidores devem reinstalar dependências (`pnpm install` + `pnpm rebuild`) ao trocar de major Node.

## Alternativas consideradas

1. **Manter Node 22 e recompilar nativos para ABI 127**
   - Rejeitado: o LionClaw v1.0 já caminhava para Node 24; Electron 33 e better-sqlite3 12.x têm melhor suporte em Node 24.

2. **Suportar múltiplas versões de Node**
   - Rejeitado: aumenta complexidade de CI e testes; módulos nativos tornam multi-version custoso.

## Implementação

- Branch: `feat/audit-v1-node24`
- Arquivos alterados:
  - `package.json`
  - `apps/*/package.json`
  - `packages/*/package.json`
  - `.github/workflows/ci.yml`
  - `.github/workflows/nightly.yml`
  - `.github/workflows/release.yml`
  - `CONTRIBUTING.md`
  - `docs/MIGRATION_FROM_LIONCLAW.md`
  - `docs/PRD.md`
  - `AGENT.md`
  - `docs/adr/0029-node-24-runtime.md` (este arquivo)

## Validação

```bash
node -v # v24.x
pnpm install
pnpm rebuild better-sqlite3 keytar node-pty
pnpm exec turbo test --force
```

Resultado esperado: todos os testes passam sem erros de ABI.

## Referências

- Relatório de auditoria: `docs/AUDIT_REPORT_LIONCLAW_WOLFKROW.md`
- Plano de implementação: `docs/audit-v1_implementation_plan.md`
- LionClaw v1.0: `electron-builder.yml` e `package.json` com Node 24 recomendado
