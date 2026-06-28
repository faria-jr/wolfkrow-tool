import type { AIStreamPort, MessageRepo } from '@wolfkrow/domain';
import { Message as MessageEntity, TokenEstimator } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface CompactSessionInput {
  sessionId: string;
  userId: string;
  model: string;
  tokenThreshold?: number;
  signal?: AbortSignal;
}

export interface CompactSessionOutput {
  compacted: boolean;
  beforeTokens: number;
  afterTokens: number;
  summary: string | undefined;
}

const DEFAULT_THRESHOLD = 4000;
const KEEP_LAST = 6;

export class CompactSessionUseCase implements UseCase<CompactSessionInput, CompactSessionOutput> {
  private readonly estimator = new TokenEstimator();

  constructor(
    private readonly messageRepo: MessageRepo,
    private readonly ai: AIStreamPort
  ) {}

  async execute(input: CompactSessionInput): Promise<CompactSessionOutput> {
    const threshold = input.tokenThreshold ?? DEFAULT_THRESHOLD;
    const messages = await this.messageRepo.findBySessionId(input.sessionId);
    const beforeTokens = this.estimator.estimateFromMessages(messages);

    if (!this.estimator.exceedsThreshold(messages, threshold)) {
      return { compacted: false, beforeTokens, afterTokens: beforeTokens, summary: undefined };
    }

    const toCompact = messages.slice(0, -KEEP_LAST);
    const toKeep = messages.slice(-KEEP_LAST);

    const summary = await this.summarize(toCompact, input.model, input.signal);

    const summaryMsg = MessageEntity.create({
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'system',
      content: `[Previous context summary] ${summary}`,
    });

    await this.messageRepo.deleteBySessionId(input.sessionId);
    await this.messageRepo.save(summaryMsg);
    for (const msg of toKeep) {
      await this.messageRepo.save(msg);
    }

    const afterMessages = await this.messageRepo.findBySessionId(input.sessionId);
    const afterTokens = this.estimator.estimateFromMessages(afterMessages);

    return { compacted: true, beforeTokens, afterTokens, summary };
  }

  private async summarize(
    messages: { role: string; content: string }[],
    model: string,
    signal?: AbortSignal
  ): Promise<string> {
    const historyText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const result = await this.ai.complete({
      model,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation in 2-3 sentences:\n\n${historyText}`,
        },
      ],
      ...(signal !== undefined ? { signal } : {}),
    });
    return result.content;
  }
}
