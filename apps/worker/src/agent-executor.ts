/**
 * Agent executor for scheduled tasks
 *
 * Loads agent config + secret API key, resolves the agent's skills, and
 * composes the system prompt from the agent prompt + enabled global rules +
 * skills (FIX-004 + FIX-016) via BuildSystemPromptUseCase — then calls the AI
 * provider.
 */

import { aiProviderFactory, type AIProvider, type AIProviderFactory } from '@wolfkrow/infra';
import { DEFAULT_AGENT_MODEL } from '@wolfkrow/shared-types';
import { type TaskExecutor } from '@wolfkrow/use-cases';

import { buildAgentSystemPrompt } from './agent-prompt';
import { getRepos } from './container';
import { getProviderApiKey, KEYTAR_SERVICE } from './lib/keychain';
import type { Logger } from './logger';

export interface AgentExecutorOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  logger?: Logger;
  providerFactory?: AIProviderFactory;
  keytarService?: string;
}

const DEFAULT_MODEL = DEFAULT_AGENT_MODEL;
const DEFAULT_TEMPERATURE = Number(process.env['AGENT_DEFAULT_TEMPERATURE']) || 0.7;
const DEFAULT_MAX_TOKENS = 4096;

interface AgentLike {
  userId: string;
  model: string;
  systemPrompt: string | undefined;
  skills: string[];
}

export function createAgentExecutor(options: AgentExecutorOptions = {}): TaskExecutor {
  const logger = options.logger;
  const providerName = options.provider ?? 'anthropic';
  const defaultModel = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const serviceName = options.keytarService ?? KEYTAR_SERVICE;
  const factory: AIProviderFactory = options.providerFactory ?? aiProviderFactory;

  return {
    async execute(task: { id: string; name: string; prompt: string; agentId: string | undefined; requiresReview?: boolean }) {
      const repos = getRepos();
      const agent = task.agentId ? ((await repos.agent.findById(task.agentId)) as AgentLike | null) : null;
      const userId = agent?.userId ?? 'default';

      const system = await buildAgentSystemPrompt(agent, userId);

      const apiKey = await getProviderApiKey(providerName, serviceName);
      const provider: AIProvider = factory.create(providerName, apiKey);
      const model = agent?.model ?? defaultModel;
      const prompt = `[Scheduled task: ${task.name}]\n\n${task.prompt}`;

      logger?.info({ taskId: task.id, agentId: task.agentId, model }, 'Calling AI provider');

      const result = await provider.complete({
        model,
        system,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
        temperature,
      });

      logger?.info(
        { taskId: task.id, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
        'AI provider response received'
      );

      const status = task.requiresReview ? ('awaiting_review' as const) : ('validated' as const);

      return {
        status,
        output: {
          content: result.content,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
      };
    },
  };
}
