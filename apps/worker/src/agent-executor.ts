/**
 * Agent executor for scheduled tasks
 *
 * Loads agent config and secret API key from the vault, then calls the AI provider.
 */

import {
  getDb,
  Schema,
  aiProviderFactory,
  type AIProvider,
  type AIProviderFactory,
} from '@wolfkrow/infra';
import { eq } from 'drizzle-orm';
import keytar from 'keytar';

import type { TaskExecutor } from '@wolfkrow/use-cases';

import type { Logger } from './logger';

export interface AgentExecutorOptions {
  provider?: string;
  model?: string;
  logger?: Logger;
  providerFactory?: AIProviderFactory;
  keytarService?: string;
}

const KEYTAR_SERVICE = 'wolfkrow';

export function createAgentExecutor(options: AgentExecutorOptions = {}): TaskExecutor {
  const logger = options.logger;
  const providerName = options.provider ?? 'anthropic';
  const model = options.model ?? 'claude-3-5-sonnet-20241022';
  const factory = options.providerFactory ?? aiProviderFactory;
  const serviceName = options.keytarService ?? KEYTAR_SERVICE;

  return {
    async execute(task: { id: string; name: string; prompt: string; agentId: string | undefined }) {
      const db = getDb();

      let agent: typeof Schema.agents.$inferSelect | undefined;
      if (task.agentId) {
        const rows = db.select().from(Schema.agents).where(eq(Schema.agents.id, task.agentId)).limit(1).all();
        agent = rows[0];
      }

      const apiKey = await keytar.getPassword(serviceName, 'anthropic-api-key');
      if (!apiKey) {
        throw new Error('Missing anthropic-api-key in system keychain');
      }

      const provider: AIProvider = factory.create(providerName, apiKey);

      const system = agent?.systemPrompt ?? 'You are a helpful assistant.';
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