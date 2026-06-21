import type { Message } from '../entities/message';

const CHARS_PER_TOKEN = 4;

export class TokenEstimator {
  estimateFromText(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  estimateFromMessages(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateFromText(m.content), 0);
  }

  exceedsThreshold(messages: Message[], threshold: number): boolean {
    return this.estimateFromMessages(messages) > threshold;
  }
}
