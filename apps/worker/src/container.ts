/**
 * Worker composition root .
 *
 * Worker routes must NOT import `@wolfkrow/infra` directly (Clean Arch §1.1).
 * This module is the only worker file that touches infra adapters; routes
 * resolve repos + adapters via `getRepos()` / `getAdapters()` instead of
 * constructing them inline.
 */

import { mkdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type {
  AICompletionOptions,
  AICompletionResult,
  AIStreamChunk,
  AIStreamPort,
  EmbeddingPort,
  ProviderConfig,
  SecretsAdapter,
  SecurityAuditRunner as SecurityAuditRunnerPort,
} from '@wolfkrow/domain';
import { ANTHROPIC_BUILTIN_ID, defaultPermissionResolver } from '@wolfkrow/domain';
import {
  aiProviderFactory,
  BashTool,
  ClaudeAgentProvider,
  ClaudeCompatProvider,
  FilesystemTool,
  FsArtifactWriter,
  SecurityAuditRunner,
  ToolRegistry,
  VoyageEmbedder,
  type AIProviderFactory,
} from '@wolfkrow/infra';
import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';

import { getAnthropicApiKey, getProviderApiKey } from './lib/keychain';

export type { RepoRegistry };
export { getHarnessAgents, makeCoderWithTools } from './agent-factory';
export type { HarnessAgents } from './agent-factory';
export { resolveProviderConfig } from './agent-factory';

/** Singleton repo registry for the worker process. */
export function getRepos(): RepoRegistry {
  return createRepoRegistry();
}

export interface AdapterBundle {
  embedder: EmbeddingPort;
  secrets: SecretsAdapter;
  aiFactory: AIProviderFactory;
  securityAuditRunner: SecurityAuditRunnerPort;
}

let _adapters: AdapterBundle | null = null;

/**
 * Singleton adapter bundle. The embedder is built from `VOYAGE_API_KEY` (env)
 * and the secrets adapter is keyless, so both are safe to construct eagerly.
 * `aiFactory` re-exposes the infra singleton so routes don't import infra.
 */
export function getAdapters(): AdapterBundle {
  if (_adapters) return _adapters;
  _adapters = {
    embedder: new VoyageEmbedder(process.env['VOYAGE_API_KEY'] ?? ''),
    secrets: new KeytarSecretsAdapter(),
    aiFactory: aiProviderFactory,
    securityAuditRunner: new SecurityAuditRunner(),
  };
  return _adapters;
}

/** Test helper: drop the cached adapter bundle. */
export function resetAdapters(): void {
  _adapters = null;
}

let _artifactWriter: FsArtifactWriter | null = null;

/** singleton artifact writer (pipeline phase artifacts → disk). */
export function getArtifactWriter(): FsArtifactWriter {
  if (_artifactWriter) return _artifactWriter;
  _artifactWriter = new FsArtifactWriter();
  return _artifactWriter;
}

let _toolRegistry: ToolRegistry | null = null;

/** singleton tool registry (bash + filesystem) for agentic chat. */
export function getToolRegistry(): ToolRegistry {
  if (_toolRegistry) return _toolRegistry;
  _toolRegistry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
  return _toolRegistry;
}

/** per-user sandboxed working dir for agentic chat tools (bash/fs). */
export function getChatWorkDir(userId: string): string {
  const dir = path.join(os.homedir(), '.wolfkrow', 'workspace', userId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * build an agentic streaming port backed by ClaudeAgentProvider with the
 * permission flow wired (destructive tools → ask → requestPermission → UI).
 * `requestPermission` receives the tool_call id and the tool name; the route
 * parks it in the permission-store until POST /chat/permission resolves it.
 */
export function getAgenticStreamPort(opts: {
  apiKey: string;
  allowedTools: readonly string[];
  requestPermission: (callId: string, tool: string) => Promise<boolean>;
  workDir?: string;
}): AIStreamPort {
  const provider = new ClaudeAgentProvider(opts.apiKey, getToolRegistry(), defaultPermissionResolver, {
    agent: { allowedTools: [...opts.allowedTools] },
    requestPermission: (e) => opts.requestPermission(e.callId, e.name),
    ...(opts.workDir !== undefined ? { workDir: opts.workDir } : {}),
  });
  return {
    query: (o: AICompletionOptions) => provider.query(o) as AsyncIterable<AIStreamChunk>,
    complete: (o: AICompletionOptions) =>
      provider.complete(o) as Promise<AICompletionResult>,
  };
}

/** Agentic stream port backed by ClaudeCompatProvider (non-Anthropic providers with tool support). */
export function getCompatAgenticStreamPort(opts: {
  cfg: ProviderConfig;
  apiKey: string;
  allowedTools: readonly string[];
  requestPermission: (callId: string, tool: string) => Promise<boolean>;
  workDir?: string;
}): AIStreamPort {
  const filteredTools = getToolRegistry().forAgent([...opts.allowedTools]);
  const registry = new ToolRegistry(filteredTools);
  const provider = new ClaudeCompatProvider(opts.apiKey, { baseUrl: opts.cfg.baseUrl }, {
    supportsTools: true,
    toolRegistry: registry,
    permissionResolver: defaultPermissionResolver,
    agent: { allowedTools: [...opts.allowedTools] },
    requestPermission: (e) => opts.requestPermission(e.callId, e.name),
    ...(opts.workDir !== undefined ? { workDir: opts.workDir } : {}),
  });
  return {
    query: (o: AICompletionOptions) => provider.query(o) as AsyncIterable<AIStreamChunk>,
    complete: (o: AICompletionOptions) => provider.complete(o) as Promise<AICompletionResult>,
  };
}

export interface ResolveAgentStreamPortOptions {
  agentProvider: string | undefined;
  allowedTools: readonly string[];
  workDir: string;
  requestPermission: (callId: string, tool: string) => Promise<boolean>;
  userId?: string;
}

/**
 * Resolve the agentic AIStreamPort for a chat agent.
 * Uses ClaudeCompatProvider for non-Anthropic providers with supportsTools.
 * Falls back to ClaudeAgentProvider (Anthropic) otherwise.
 */
export async function resolveAgentStreamPort({
  agentProvider,
  allowedTools,
  workDir,
  requestPermission,
  userId,
}: ResolveAgentStreamPortOptions): Promise<AIStreamPort> {
  const { resolveProviderConfig } = await import('./agent-factory');
  const provId = agentProvider ?? ANTHROPIC_BUILTIN_ID;
  const provCfg = await resolveProviderConfig(provId, userId);

  if (provCfg.supportsTools && provId !== ANTHROPIC_BUILTIN_ID) {
    const apiKey = (await getAdapters().secrets.get(provCfg.apiKeyAccount))
      ?? (await getProviderApiKey(provId));
    return getCompatAgenticStreamPort({
      cfg: provCfg,
      apiKey,
      allowedTools,
      ...(workDir !== undefined ? { workDir } : {}),
      requestPermission,
    });
  }

  const apiKey = await getAnthropicApiKey();
  return getAgenticStreamPort({ apiKey, allowedTools, workDir, requestPermission });
}

/** Workspace dir scoped per project for harness coder sandboxing. */
export function getHarnessProjectWorkDir(projectId: string): string {
  return path.join(
    process.env['HARNESS_WORKSPACE_DIR'] ?? os.tmpdir(),
    'wolfkrow-harness',
    projectId,
  );
}
