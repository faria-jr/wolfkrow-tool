import type {
  HarnessConfig,
  ProviderConfig,
  ToolExecutor,
} from '@wolfkrow/domain';
import { ANTHROPIC_BUILTIN_ID, BUILT_IN_PROVIDERS, defaultPermissionResolver, getProviderById, mergeProviders } from '@wolfkrow/domain';
import {
  BashTool,
  ClaudeAgentProvider,
  ClaudeCompatProvider,
  FilesystemTool,
  ToolRegistry,
  type AIProvider,
} from '@wolfkrow/infra';
import type { CoderAgent, EvaluatorAgent, HarnessPlanner } from '@wolfkrow/use-cases';

import { getAdapters, getRepos } from './container';
import { getProviderApiKey } from './lib/keychain';

export interface HarnessAgents {
  planner: HarnessPlanner;
  coder: CoderAgent;
  evaluator: EvaluatorAgent;
}

async function listAllProviders(userId?: string): Promise<ProviderConfig[]> {
  if (!userId) return BUILT_IN_PROVIDERS;
  const custom = await getRepos().providerConfig.findAll(userId);
  return mergeProviders(BUILT_IN_PROVIDERS, custom);
}

export { listAllProviders, resolveProviderConfig };

async function resolveProviderConfig(providerId: string, userId?: string): Promise<ProviderConfig> {
  const all = await listAllProviders(userId);
  return getProviderById(all, providerId) ?? getProviderById(all, ANTHROPIC_BUILTIN_ID)!;
}

async function resolveAIProvider(providerId: string, userId?: string): Promise<AIProvider> {
  const cfg = await resolveProviderConfig(providerId, userId);
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount))
    ?? (await getProviderApiKey(cfg.id));
  return getAdapters().aiFactory.createFromConfig(cfg, apiKey);
}

export async function getHarnessAgents(config: HarnessConfig, userId?: string): Promise<HarnessAgents> {
  const [planner, coder, evaluator] = await Promise.all([
    makePlanner(config, userId),
    makeCoder(config, userId),
    makeEvaluator(config, userId),
  ]);
  return { planner, coder, evaluator };
}

async function makePlanner(config: HarnessConfig, userId?: string): Promise<HarnessPlanner> {
  return {
    async plan(specContent: string, planConfig: { plannerModel: string; repoSummary?: string }) {
      const provider = await resolveAIProvider(config.providerId ?? ANTHROPIC_BUILTIN_ID, userId);
      const repoContext = planConfig.repoSummary ? `\n\nRepository context:\n${planConfig.repoSummary}` : '';
      const result = await provider.complete({
        model: planConfig.plannerModel,
        system: 'You are a senior software architect. Given a spec, output a JSON array of sprints. Each sprint: {name, description, features: [{name, description, acceptanceCriteria: string[]}]}. Respond ONLY with valid JSON array.',
        messages: [{ role: 'user', content: `Create sprint plan for:\n\n${specContent}${repoContext}` }],
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

async function makeCoder(config: HarnessConfig, userId?: string): Promise<CoderAgent> {
  return {
    async implement(input: { sprintName: string; featureName: string; featureDescription: string; acceptanceCriteria: string[]; previousFeedback?: string; coderModel: string }) {
      const provider = await resolveAIProvider(config.providerId ?? ANTHROPIC_BUILTIN_ID, userId);
      const previousContext = input.previousFeedback ? `\n\nPrevious evaluator feedback:\n${input.previousFeedback}` : '';
      const result = await provider.complete({
        model: input.coderModel,
        system: 'You are an expert software engineer. Implement the requested feature with clean, tested code.',
        messages: [{
          role: 'user',
          content: `Sprint: ${input.sprintName}\nFeature: ${input.featureName}\nDescription: ${input.featureDescription}\nAcceptance Criteria:\n${input.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n')}${previousContext}\n\nImplement this feature completely.`,
        }],
        maxTokens: 8192,
        temperature: 0.2,
      });
      return { output: result.content, tokens: result.usage.inputTokens + result.usage.outputTokens };
    },
  };
}

async function makeEvaluator(config: HarnessConfig, userId?: string): Promise<EvaluatorAgent> {
  return {
    async evaluate(input: { coderOutput: string; acceptanceCriteria: string[]; onChunk?: (delta: string) => void }) {
      const provider = await resolveAIProvider(config.providerId ?? ANTHROPIC_BUILTIN_ID, userId);
      // DEBT #29 — stream the evaluator output, forwarding deltas for live display.
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      for await (const chunk of provider.query({
        model: 'claude-sonnet-4-6',
        system: 'You are a QA engineer. Evaluate if the implementation meets the acceptance criteria. Respond with JSON: {passed: boolean, feedback: string}',
        messages: [{
          role: 'user',
          content: `Acceptance Criteria:\n${input.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n')}\n\nImplementation:\n${input.coderOutput}\n\nDoes this implementation satisfy all acceptance criteria?`,
        }],
        maxTokens: 1024,
        temperature: 0.1,
      })) {
        if (chunk.delta) {
          content += chunk.delta;
          input.onChunk?.(chunk.delta);
        }
        if (chunk.inputTokens) inputTokens = chunk.inputTokens;
        if (chunk.outputTokens) outputTokens = chunk.outputTokens;
      }
      try {
        const raw = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
        const parsed = JSON.parse(raw) as { passed: boolean; feedback: string };
        return { ...parsed, tokens: inputTokens + outputTokens };
      } catch {
        return { passed: false, feedback: content, tokens: inputTokens + outputTokens };
      }
    },
  };
}

function createToolProvider(cfg: ProviderConfig, apiKey: string, tools: ToolExecutor[], workDir: string) {
  const registry = new ToolRegistry(tools);
  if (cfg.protocol === 'anthropic-compat' && cfg.supportsTools) {
    return new ClaudeCompatProvider(apiKey, { baseUrl: cfg.baseUrl }, {
      supportsTools: true,
      toolRegistry: registry,
      permissionResolver: defaultPermissionResolver,
      agent: { allowedTools: tools.map((t) => t.name) },
      workDir,
    });
  }
  return new ClaudeAgentProvider(apiKey, registry, defaultPermissionResolver, {
    agent: { allowedTools: tools.map((t) => t.name) },
    maxTurns: 80,
    workDir,
  });
}

/** CoderAgent backed by the configured provider with bash + filesystem tools sandboxed to workDir. */
export async function makeCoderWithTools(workDir: string, config: HarnessConfig, userId?: string): Promise<CoderAgent> {
  const providerId = config.providerId ?? ANTHROPIC_BUILTIN_ID;
  const cfg = await resolveProviderConfig(providerId, userId);
  const apiKey = (await getAdapters().secrets.get(cfg.apiKeyAccount))
    ?? (await getProviderApiKey(cfg.id));
  const tools = [new BashTool(), new FilesystemTool()];
  const systemPrompt =
    'You are an expert software engineer with access to bash and filesystem tools. ' +
    'Implement the requested feature with clean, tested code. ' +
    'Write files to the workspace directory. Run tests to verify your implementation.';

  return {
    async implement(input: { sprintName: string; featureName: string; featureDescription: string; acceptanceCriteria: string[]; previousFeedback?: string; coderModel: string; onChunk?: (delta: string) => void }) {
      const previousContext = input.previousFeedback
        ? `\n\nPrevious evaluator feedback:\n${input.previousFeedback}`
        : '';
      const prompt =
        `Sprint: ${input.sprintName}\n` +
        `Feature: ${input.featureName}\n` +
        `Description: ${input.featureDescription}\n` +
        `Acceptance Criteria:\n${input.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n')}` +
        `${previousContext}\n\nImplement this feature completely. Use your tools to write files and run tests.`;

      const provider = createToolProvider(cfg, apiKey, tools, workDir);
      // DEBT #29 — stream the agentic loop, forwarding text deltas for live output.
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      for await (const chunk of provider.query({
        model: input.coderModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 16384,
        temperature: 0.2,
      })) {
        if (chunk.delta) {
          content += chunk.delta;
          input.onChunk?.(chunk.delta);
        }
        if (chunk.inputTokens) inputTokens = chunk.inputTokens;
        if (chunk.outputTokens) outputTokens = chunk.outputTokens;
      }
      return { output: content, tokens: inputTokens + outputTokens };
    },
  };
}
