# Wolfkrow-Tool Audit & Implementation Plan

This implementation plan details the necessary changes to refactor, debug, and polish the `wolfkrow-tool` project to match the functionality, layout, and UX standards of `lionclawv1.0` in a Next.js 15 App Router architecture.

## User Review Required

> [!IMPORTANT]
>
> 1. **Auto-Lock Screen Hook (`useAutoLock`)**: Changing it to a no-op as requested. The application will request a password/lock only when the 30-day JWT cookie expires.
> 2. **Built-in Skills & MCP Servers**: Unifying built-in and user-created elements by querying `userId = 'system' | null` so users can see, edit, and delete them freely.
> 3. **Provider Keychain Service Name**: Standardizing keytar service name to `'wolfkrow'` across the web and worker apps to fix key lookup issues.

## Proposed Changes

---

### Component: Core Settings & Auth

#### [MODIFY] [keychain.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/worker/src/lib/keychain.ts)

- Align `KEYTAR_SERVICE` constant to match the keytar adapter service name (`'wolfkrow'`).

#### [MODIFY] [keytar-adapter.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/packages/infra/src/secrets/keytar-adapter.ts)

- Change constant `SERVICE` from `'wolfkrow-tool'` to `'wolfkrow'` to unify with the worker API lookup.

#### [MODIFY] [use-auto-lock.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/hooks/use-auto-lock.ts)

- Disable the 5-minute inactivity auto-lock by turning it into a no-op hook.

---

### Component: Providers & API Keys

#### [MODIFY] [providers.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/worker/src/routes/providers.ts)

- Add `isOverridden` and `isCustom` flags to GET `/providers` response.

#### [MODIFY] [provider-list.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/settings/provider-config/provider-list.tsx)

- Enable "Delete Override" or "Restore Default" action for overridden built-in providers by calling DELETE on their custom ID.

#### [MODIFY] [factory.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/packages/infra/src/ai-providers/factory.ts)

- Map direct provider IDs like `zai`, `minimax`, `moonshot`, and `qwen` automatically to `ClaudeCompatProvider` without forcing the `claude-compat:` prefix.

---

### Component: Skills & MCP Servers

#### [MODIFY] [route.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/app/api/skills/%5Bid%5D/route.ts)

- Allow `PUT` and `DELETE` requests for skills owned by the system user (`'system'`).

#### [MODIFY] [list-skills.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/packages/use-cases/src/skills/list-skills.ts)

- Merge built-in skills and user skills in `ListSkillsUseCase` so built-in skills are listed for all users.

#### [MODIFY] [mcp-server-repo.ts](file:///Users/juniorfaria/projects/wolfkrow-tool/packages/infra/src/repos/mcp-server-repo.ts)

- Update `findAll` to query both `userId = session.userId` and `userId IS NULL` so built-in MCP servers are displayed on the list.

---

### Component: Agent Configuration

#### [MODIFY] [agent-form-body.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/agents/agent-form-body.tsx)

- Order fields sequentially in the exact format: `Name`, `System Prompt` (with markdown editor), `Effort`, `Max turns`, `Provider`, `Model`, `Runtime`.
- Move other configurations (Tools, Thinking, Skills) to optional tab sections below.

---

### Component: Channels Configuration

#### [MODIFY] [telegram-setup.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/channels/telegram-setup.tsx)

- Add the required setup inputs: Bot Token (stored in Vault/keychain), Authorized User Name, Authorized User ID, and a checkbox to notify about scheduled tasks.

---

### Component: Harness & Pipeline Live Screens

#### [MODIFY] [harness-view.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/harness/harness-view.tsx)

- Capture and propagate detailed API error messages (e.g. invalid absolute paths or paths outside allowed roots) during project creation.

#### [MODIFY] [pipeline-view.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/pipeline/pipeline-view.tsx)

- Propagate detailed API creation errors to the client.

#### [MODIFY] [execution-view.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/harness/execution-view.tsx)

- Redesign to a polished dual-panel dashboard layout matching Lionclaw:
  - Left Panel: Sprint details, execution history, and feature list.
  - Right Panel: Coder vs Evaluator live streaming views with real-time logs, tokens/cost metrics, and inline HITL chat for active rounds.

#### [MODIFY] [pipeline-run-console.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/pipeline/pipeline-run-console.tsx)

- Redesign the pipeline console into a timeline view showing all stages (Discovery, Spec Build, Spec Validate, Approval, Implementation) with status colors, active agent thinking animations, and split-screen document preview when artifacts are updated.

---

### Component: OpenDesign Studio Connection

#### [MODIFY] [page.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/app/%28app%29/design/page.tsx)

- Accept `projectId` parameters and render `SessionConfigView` / `BootstrappingView` if the session is not bootstrapped, pointing the Visual Editor iframe only when fully ready.

---

### Component: Global Features (Pagination)

#### [NEW] [pagination.tsx](file:///Users/juniorfaria/projects/wolfkrow-tool/apps/web/components/common/pagination.tsx)

- Implement a reusable `<Pagination />` component.
- Add pagination controls to all main registers (Agents, Skills, MCP Servers, Knowledge, Harness, Pipeline, Vault, Channels).

---

## Verification Plan

### Automated Tests

- Run Turborepo tests to ensure no regressions occur:
  - `pnpm test`
  - `pnpm lint`

### Manual Verification

- Access and test JWT login lock timing (verify 30-day persistence).
- Create a project with invalid paths to verify detailed error messages are displayed.
- Override a built-in provider, edit, and then restore it to defaults.
- Run a Harness project sprint to verify side-by-side Coder and Evaluator streams with logs and inline round history.
- Start design studio for a project to verify the bootstrap progress view is rendered.
