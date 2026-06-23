# Contributing

Thank you for your interest in contributing to Wolfkrow Tool! This document outlines the process and guidelines.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites

- Node.js 24+
- pnpm 9+
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/wolfkrow-labs/wolfkrow-tool.git
cd wolfkrow-tool

# Install dependencies
pnpm install

# Run development
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Development Workflow

### TDD (Test-Driven Development)

We follow strict TDD. For each feature:

1. **RED**: Write failing test
2. **GREEN**: Make it pass with minimum code
3. **REFACTOR**: Improve code without breaking tests

See [ADR-0020](./docs/adr/0020-tdd-workflow.md) for details.

### Git Workflow

We use [GitHub Flow](https://guides.github.com/introduction/flow/):

1. Create feature branch from `main`
2. Make commits with [Conventional Commits](https://www.conventionalcommits.org/)
3. Open PR when ready
4. After review and CI green, squash-merge to `main`

### Commit Messages

```
feat: add voice conversation panel
fix: resolve SSE reconnection bug
docs: update ADR-001 with rationale
refactor: extract AIProvider strategy pattern
test: add unit tests for AgentRepo
chore: update dependencies
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`

### Branch Naming

```
feat/short-description
fix/issue-number-description
refactor/component-name
docs/what-changed
```

### Pull Request Process

1. Update SPEC if architecture/UX changes
2. Add ADR if significant decision
3. Ensure CI green: lint, typecheck, test, build
4. Request review from tech lead
5. Squash-merge after approval

## Code Style

We use ESLint + Prettier. Run before committing:

```bash
pnpm lint:fix
pnpm format
```

Key conventions:
- TypeScript strict mode (no `any`)
- Max 50 lines per function (ESLint enforced)
- Max 4 parameters per function
- Max cyclomatic complexity 10
- Early return preferred over nested ifs
- Pure functions in domain/application layers

See [AGENT.md](./AGENT.md) for detailed guidelines.

## Testing

We aim for:
- Domain layer: ≥95% coverage
- Use cases: ≥90% coverage
- Infrastructure: ≥85% coverage
- UI components: ≥70% coverage
- E2E: 50 critical scenarios

```bash
pnpm test          # Unit + integration
pnpm test:cov      # With coverage
pnpm test:e2e      # Playwright E2E
```

## Documentation

- Update README.md for user-facing changes
- Update AGENT.md for dev conventions
- Create/update SPEC for feature changes
- Create ADR for architectural decisions

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full picture.

Key principles:
- **Clean Architecture**: 4 isolated layers
- **TDD**: Test-first development
- **SOLID**: Single responsibility, Open/Closed, etc
- **DRY**: Single source of truth (Zod schemas)
- **Domain Events**: Decouple use cases

## Adding a New Package

```bash
# Create new package directory
mkdir packages/my-package
cd packages/my-package

# Initialize
pnpm init
# Edit package.json: name "@wolfkrow/my-package"

# Create tsconfig.json extending base
# Create src/index.ts
# Add to pnpm-workspace.yaml (already covers packages/*)
```

## Release Process

See [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) for release milestones.

For each release:
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag `vX.Y.Z`
4. Push tag → CI builds + creates GitHub Release
5. Binaries auto-generated for macOS, Windows, Linux

## License

By contributing, you agree that your contributions will be licensed under the project's [LICENSE](./LICENSE).
