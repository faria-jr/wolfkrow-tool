/**
 * Agent executor for scheduled tasks
 *
 * Loads agent config + secret API key, resolves the agent's skills, and
 * composes the system prompt from the agent prompt + enabled global rules +
 * skills via BuildSystemPromptUseCase — then calls the AI
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

interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  agentId: string | undefined;
  requiresReview?: boolean;
}

async function runScheduledTask(
  task: ScheduledTask,
  opts: {
    logger?: Logger;
    providerName: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    serviceName: string;
    factory: AIProviderFactory;
  }
): Promise<{
  status: 'awaiting_review' | 'validated';
  output: { content: string; inputTokens: number; outputTokens: number };
}> {
  const repos = getRepos();
  const agent = task.agentId
    ? ((await repos.agent.findById(task.agentId)) as AgentLike | null)
    : null;
  const userId = agent?.userId ?? 'default';

  const system = await buildAgentSystemPrompt(agent, userId);

  const apiKey = await getProviderApiKey(opts.providerName, opts.serviceName);
  const provider: AIProvider = opts.factory.create(opts.providerName, apiKey);
  const model = agent?.model ?? opts.defaultModel;
  const prompt = `[Scheduled task: ${task.name}]\n\n${task.prompt}`;

  opts.logger?.info({ taskId: task.id, agentId: task.agentId, model }, 'Calling AI provider');

  const result = await provider.complete({
    model,
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });

  opts.logger?.info(
    {
      taskId: task.id,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
    'AI provider response received'
  );

  return {
    status: task.requiresReview ? 'awaiting_review' : 'validated',
    output: {
      content: result.content,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
  };
}

export function createAgentExecutor(options: AgentExecutorOptions = {}): TaskExecutor {
  const runOpts = {
    providerName: options.provider ?? 'anthropic',
    defaultModel: options.model ?? DEFAULT_MODEL,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    serviceName: options.keytarService ?? KEYTAR_SERVICE,
    factory: (options.providerFactory ?? aiProviderFactory) as AIProviderFactory,
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
  };
  return {
    async execute(task: ScheduledTask) {
      return runScheduledTask(task, runOpts);
    },
  };
}
