/**
 * Agent executor for scheduled tasks
 *
 * Loads agent config + secret API key, resolves the agent's skills, and
 * composes the system prompt from the agent prompt + enabled global rules +
 * skills (FIX-004 + FIX-016) via BuildSystemPromptUseCase — then calls the AI
 * provider.
 */

import { aiProviderFactory, type AIProvider, type AIProviderFactory } from '@wolfkrow/infra';
import { type TaskExecutor } from '@wolfkrow/use-cases';
import keytar from 'keytar';

import { buildAgentSystemPrompt } from './agent-prompt';
import { getRepos } from './container';
import type { Logger } from './logger';

export interface AgentExecutorOptions {
  provider?: string;
  model?: string;
  logger?: Logger;
  providerFactory?: AIProviderFactory;
  keytarService?: string;
}

const KEYTAR_SERVICE = 'wolfkrow';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

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
  const serviceName = options.keytarService ?? KEYTAR_SERVICE;
  const factory: AIProviderFactory = options.providerFactory ?? aiProviderFactory;

  return {
    async execute(task: { id: string; name: string; prompt: string; agentId: string | undefined }) {
      const repos = getRepos();
      const agent = task.agentId ? ((await repos.agent.findById(task.agentId)) as AgentLike | null) : null;
      const userId = agent?.userId ?? 'default';

      const system = await buildAgentSystemPrompt(agent, userId);

      const apiKey = await keytar.getPassword(serviceName, 'anthropic-api-key');
      if (!apiKey) {
        throw new Error('Missing anthropic-api-key in system keychain');
      }

      const provider: AIProvider = factory.create(providerName, apiKey);
      const model = agent?.model ?? defaultModel;
      const prompt = `[Scheduled task: ${task.name}]\n\n${task.prompt}`;

      logger?.info({ taskId: task.id, agentId: task.agentId, model }, 'Calling AI provider');

      const result = await provider.complete({
        model,
        system,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4096,
        temperature: 0.5,
      });

      logger?.info(
        { taskId: task.id, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
        'AI provider response received'
      );

      return {
        status: 'validated' as const,
        output: {
          content: result.content,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        },
      };
    },
  };
}
