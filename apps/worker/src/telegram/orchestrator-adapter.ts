import { DEFAULT_AGENT_MODEL } from '@wolfkrow/shared-types';

import type { OrchestratorService } from '../orchestrator';


import type { TelegramChatAdapter } from './bridge';

const DEFAULT_MODEL = DEFAULT_AGENT_MODEL;

export class OrchestratorChatAdapter implements TelegramChatAdapter {
  constructor(private readonly orchestrator: OrchestratorService) {}

  async chat(userId: string, text: string): Promise<string> {
    const chunks: string[] = [];
    const stream = this.orchestrator.stream({
      messages: [{ role: 'user', content: text }],
      model: DEFAULT_MODEL,
      userId,
    });
    for await (const chunk of stream) {
      if (chunk.delta) chunks.push(chunk.delta);
    }
    return chunks.join('') || '(no response)';
  }
}
