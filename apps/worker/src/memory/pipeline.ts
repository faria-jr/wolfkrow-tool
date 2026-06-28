/**
 * Memory pipeline: extract facts from completed chat sessions → embed → persist.
 * Called after a session ends or reaches token threshold.
 */
import type { EmbeddingPort, SemanticMemoryRepo } from '@wolfkrow/domain';
import { AddMemoryUseCase } from '@wolfkrow/use-cases';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MemoryPipelineOptions {
  minImportance?: number;
}

export class MemoryPipeline {
  private readonly addMemory: AddMemoryUseCase;

  constructor(memoryRepo: SemanticMemoryRepo, embedder: EmbeddingPort) {
    this.addMemory = new AddMemoryUseCase(memoryRepo, embedder);
  }

  async extractAndStore(
    userId: string,
    messages: SessionMessage[],
    options: MemoryPipelineOptions = {}
  ): Promise<void> {
    const facts = this.extractFacts(messages);
    if (facts.length === 0) return;

    await Promise.all(
      facts.map((fact) =>
        this.addMemory.execute({
          userId,
          content: fact,
          source: 'conversation',
          importance: options.minImportance ?? 50,
        })
      )
    );
  }

  private extractFacts(messages: SessionMessage[]): string[] {
    const facts: string[] = [];

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const content = msg.content.trim();
      if (content.length < 20) continue;

      const sentences = content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      for (const sentence of sentences) {
        if (this.isMemorableStatement(sentence)) {
          facts.push(sentence);
        }
      }
    }

    return facts.slice(0, 10);
  }

  private isMemorableStatement(text: string): boolean {
    const lower = text.toLowerCase();
    const markers = [
      'i prefer',
      'i like',
      'i dislike',
      'i hate',
      'i love',
      'i always',
      'i never',
      'i usually',
      'my name',
      'i am',
      "i'm",
      'i work',
      'remember that',
      'important:',
      'note that',
      'always use',
      'never use',
      'please remember',
    ];
    return markers.some((m) => lower.includes(m));
  }
}
