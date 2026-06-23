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
  SecretsAdapter,
} from '@wolfkrow/domain';
import { defaultPermissionResolver } from '@wolfkrow/domain';
import {
  aiProviderFactory,
  BashTool,
  ClaudeAgentProvider,
  FilesystemTool,
  FsArtifactWriter,
  type AIProviderFactory,
  ToolRegistry,
  VoyageEmbedder,
} from '@wolfkrow/infra';
import { createRepoRegistry, type RepoRegistry } from '@wolfkrow/infra/repos';
import { KeytarSecretsAdapter } from '@wolfkrow/infra/secrets/keytar-adapter';
import type { CoderAgent, EvaluatorAgent, HarnessPlanner } from '@wolfkrow/use-cases';

import { getProviderApiKey } from './lib/keychain';

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

export interface HarnessAgents {
  planner: HarnessPlanner;
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
}

export function getHarnessAgents(): HarnessAgents {
  return { planner: makePlanner(), coder: makeCoder(), evaluator: makeEvaluator() };
}

function makePlanner(): HarnessPlanner {
  return {
    async plan(specContent, config) {
      const apiKey = await getProviderApiKey('anthropic');
      const provider = getAdapters().aiFactory.create('anthropic', apiKey);
      const result = await provider.complete({
        model: config.plannerModel,
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

function makeCoder(): CoderAgent {
  return {
    async implement(input) {
      const apiKey = await getProviderApiKey('anthropic');
      const provider = getAdapters().aiFactory.create('anthropic', apiKey);
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

function makeEvaluator(): EvaluatorAgent {
  return {
    async evaluate(input) {
      const apiKey = await getProviderApiKey('anthropic');
      const provider = getAdapters().aiFactory.create('anthropic', apiKey);
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
export function makeCoderWithTools(workDir: string): CoderAgent {
  return {
    async implement(input) {
      const apiKey = await getProviderApiKey('anthropic');
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
