/**
 * Worker composition root (FIX-007).
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
  HarnessConfig,
  SecretsAdapter,
} from '@wolfkrow/domain';
import { BUILT_IN_PROVIDERS, defaultPermissionResolver, getProviderById } from '@wolfkrow/domain';
import {
  aiProviderFactory,
  BashTool,
  ClaudeAgentProvider,
  ClaudeCompatProvider,
  FilesystemTool,
  FsArtifactWriter,
  type AIProvider,
  type AIProviderFactory,
  ToolRegistry,
  VoyageEmbedder,
} from '@wolfkrow/infra';
import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';
import type { CoderAgent, EvaluatorAgent, HarnessPlanner } from '@wolfkrow/use-cases';

import { getAnthropicApiKey, getProviderApiKey } from './lib/keychain';

export type { RepoRegistry };

/** Singleton repo registry for the worker process. */
export function getRepos(): RepoRegistry {
  return createRepoRegistry();
}

export interface AdapterBundle {
  embedder: EmbeddingPort;
  secrets: SecretsAdapter;
  aiFactory: AIProviderFactory;
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
  };
  return _adapters;
}

/** Test helper: drop the cached adapter bundle. */
export function resetAdapters(): void {
  _adapters = null;
}

let _artifactWriter: FsArtifactWriter | null = null;

/** T26: singleton artifact writer (pipeline phase artifacts → disk). */
export function getArtifactWriter(): FsArtifactWriter {
  if (_artifactWriter) return _artifactWriter;
  _artifactWriter = new FsArtifactWriter();
  return _artifactWriter;
}

let _toolRegistry: ToolRegistry | null = null;

/** T17: singleton tool registry (bash + filesystem) for agentic chat. */
export function getToolRegistry(): ToolRegistry {
  if (_toolRegistry) return _toolRegistry;
  _toolRegistry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
  return _toolRegistry;
}

/** T17: per-user sandboxed working dir for agentic chat tools (bash/fs). */
export function getChatWorkDir(userId: string): string {
  const dir = path.join(os.homedir(), '.wolfkrow', 'workspace', userId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * T17: build an agentic streaming port backed by ClaudeAgentProvider with the
 * permission flow wired (destructive tools → ask → requestPermission → UI).
 * `requestPermission` receives the tool_call id; the route parks it in the
 * permission-store until POST /chat/permission resolves it.
 */
export function getAgenticStreamPort(opts: {
  apiKey: string;
  allowedTools: readonly string[];
  requestPermission: (callId: string) => Promise<boolean>;
  workDir?: string;
}): AIStreamPort {
  const provider = new ClaudeAgentProvider(opts.apiKey, getToolRegistry(), defaultPermissionResolver, {
    agent: { allowedTools: [...opts.allowedTools] },
    requestPermission: (e) => opts.requestPermission(e.callId),
    ...(opts.workDir !== undefined ? { workDir: opts.workDir } : {}),
  });
  return {
    query: (o: AICompletionOptions) => provider.query(o) as AsyncIterable<AIStreamChunk>,
    complete: (o: AICompletionOptions) =>
      provider.complete(o) as Promise<AICompletionResult>,
  };
}

/** RM3.2: agentic stream port backed by ClaudeCompatProvider (non-Anthropic with tool support). */
export function getCompatAgenticStreamPort(opts: {
  cfg: import('@wolfkrow/domain').ProviderConfig;
  apiKey: string;
  allowedTools: readonly string[];
  requestPermission: (callId: string) => Promise<boolean>;
  workDir?: string;
}): AIStreamPort {
  const filteredTools = getToolRegistry().forAgent([...opts.allowedTools]);
  const registry = new ToolRegistry(filteredTools);
  const provider = new ClaudeCompatProvider(opts.apiKey, { baseUrl: opts.cfg.baseUrl }, true, registry);
  return {
    query: (o: AICompletionOptions) => provider.query(o) as AsyncIterable<AIStreamChunk>,
    complete: (o: AICompletionOptions) => provider.complete(o) as Promise<AICompletionResult>,
  };
}

/**
 * RM3.2: resolve the correct agentic AIStreamPort for a chat agent.
 * Uses ClaudeCompatProvider for non-Anthropic providers with supportsTools.
 * Falls back to ClaudeAgentProvider (Anthropic) otherwise.
 */
export async function resolveAgentStreamPort(
  agentProvider: string | undefined,
  allowedTools: readonly string[],
  workDir: string,
  requestPermission: (callId: string) => Promise<boolean>,
): Promise<AIStreamPort> {
  const provId = agentProvider ?? 'anthropic';
  const provCfg = getProviderById(BUILT_IN_PROVIDERS, provId);

  if (provCfg && provCfg.supportsTools && provId !== 'anthropic') {
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

export interface HarnessAgents {
  planner: HarnessPlanner;
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
}

export function getHarnessAgents(config: HarnessConfig): HarnessAgents {
  return { planner: makePlanner(config), coder: makeCoder(config), evaluator: makeEvaluator(config) };
}

async function resolveAIProvider(providerId: string): Promise<AIProvider> {
  const cfg = getProviderById(BUILT_IN_PROVIDERS, providerId)
    ?? getProviderById(BUILT_IN_PROVIDERS, 'anthropic')!;
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount))
    ?? (await getProviderApiKey(cfg.id));
  return getAdapters().aiFactory.createFromConfig(cfg, apiKey);
}

function makePlanner(config: HarnessConfig): HarnessPlanner {
  return {
    async plan(specContent, planConfig) {
      const provider = await resolveAIProvider(config.providerId ?? 'anthropic');
      const result = await provider.complete({
        model: planConfig.plannerModel,
        system: 'You are a senior software architect. Given a spec, output a JSON array of sprints. Each sprint: {name, description, features: [{name, description, acceptanceCriteria: string[]}]}. Respond ONLY with valid JSON array.',
        messages: [{ role: 'user', content: `Create sprint plan for:\n\n${specContent}` }],
        maxTokens: 4096,
        temperature: 0.3,
      });
      try {
        const raw = result.content.match(/\[[\s\S]*\]/)?.[0] ?? result.content;
        return JSON.parse(raw) as Array<{ name: string; description: string; features: Array<{ name: string; description: string; acceptanceCriteria: string[] }> }>;
      } catch {
        return [{ name: 'Sprint 1', description: specContent.slice(0, 200), features: [{ name: 'Implementation', description: specContent.slice(0, 500), acceptanceCriteria: ['All features implemented'] }] }];
      }
    },
  };
}

function makeCoder(config: HarnessConfig): CoderAgent {
  return {
    async implement(input) {
      const provider = await resolveAIProvider(config.providerId ?? 'anthropic');
      const previousContext = input.previousFeedback ? `\n\nPrevious evaluator feedback:\n${input.previousFeedback}` : '';
      const result = await provider.complete({
        model: input.coderModel,
        system: 'You are an expert software engineer. Implement the requested feature with clean, tested code.',
        messages: [{
          role: 'user',
          content: `Sprint: ${input.sprintName}\nFeature: ${input.featureName}\nDescription: ${input.featureDescription}\nAcceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}${previousContext}\n\nImplement this feature completely.`,
        }],
        maxTokens: 8192,
        temperature: 0.2,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}

function makeEvaluator(config: HarnessConfig): EvaluatorAgent {
  return {
    async evaluate(input) {
      const provider = await resolveAIProvider(config.providerId ?? 'anthropic');
      const result = await provider.complete({
        model: 'claude-sonnet-4-6',
        system: 'You are a QA engineer. Evaluate if the implementation meets the acceptance criteria. Respond with JSON: {passed: boolean, feedback: string}',
        messages: [{
          role: 'user',
          content: `Acceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}\n\nImplementation:\n${input.coderOutput}\n\nDoes this implementation satisfy all acceptance criteria?`,
        }],
        maxTokens: 1024,
        temperature: 0.1,
      });
      try {
        const raw = result.content.match(/\{[\s\S]*\}/)?.[0] ?? result.content;
        const parsed = JSON.parse(raw) as { passed: boolean; feedback: string };
        return { ...parsed, tokens: result.usage.inputTokens + result.usage.outputTokens };
      } catch {
        return { passed: false, feedback: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
      }
    },
  };
}

/** Workspace dir scoped per project for harness coder sandboxing. */
export function getHarnessProjectWorkDir(projectId: string): string {
  return path.join(
    process.env['HARNESS_WORKSPACE_DIR'] ?? os.tmpdir(),
    'wolfkrow-harness',
    projectId,
  );
}

/** CoderAgent backed by ClaudeAgentProvider with bash + filesystem tools sandboxed to workDir. */
export function makeCoderWithTools(workDir: string, config: HarnessConfig): CoderAgent {
  return {
    async implement(input) {
      const providerId = config.providerId ?? 'anthropic';
      const cfg = getProviderById(BUILT_IN_PROVIDERS, providerId)
        ?? getProviderById(BUILT_IN_PROVIDERS, 'anthropic')!;
      const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount))
        ?? (await getProviderApiKey(cfg.id));
      const registry = new ToolRegistry([new BashTool(), new FilesystemTool()]);
      const provider = new ClaudeAgentProvider(apiKey, registry, undefined, { maxTurns: 80, workDir });
      const previousContext = input.previousFeedback
        ? `\n\nPrevious evaluator feedback:\n${input.previousFeedback}`
        : '';
      const result = await provider.complete({
        model: input.coderModel,
        system:
          'You are an expert software engineer with access to bash and filesystem tools. ' +
          'Implement the requested feature with clean, tested code. ' +
          'Write files to the workspace directory. Run tests to verify your implementation.',
        messages: [{
          role: 'user',
          content:
            `Sprint: ${input.sprintName}\n` +
            `Feature: ${input.featureName}\n` +
            `Description: ${input.featureDescription}\n` +
            `Acceptance Criteria:\n${input.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}` +
            `${previousContext}\n\nImplement this feature completely. Use your tools to write files and run tests.`,
        }],
        maxTokens: 16384,
        temperature: 0.2,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}
