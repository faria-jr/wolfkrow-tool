import type { EmbeddingPort, SemanticMemory, SemanticMemoryRepo } from '@wolfkrow/domain';
import { describe, expect, it } from 'vitest';

import { MemoryPipeline } from '../pipeline';

/** In-memory fakes so the pipeline can be exercised without a DB. */
function fakeEmbedder(): EmbeddingPort {
  return {
    dimensions: 1,
    embed: async (text: string) => [text.length],
    embedBatch: async (texts: string[]) => texts.map((t) => [t.length]),
  };
}

function fakeMemoryRepo(): { saved: SemanticMemory[] } & SemanticMemoryRepo {
  const saved: SemanticMemory[] = [];
  return {
    saved,
    findById: async () => null,
    findByUserId: async () => saved,
    save: async (m) => {
      saved.push(m);
      return m;
    },
    delete: async () => undefined,
    deleteByUserId: async () => undefined,
    vectorSearch: async () => [],
  };
}

describe('MemoryPipeline (FIX-012)', () => {
  it('extracts memorable user statements and persists them', async () => {
    const repo = fakeMemoryRepo();
    const pipeline = new MemoryPipeline(repo, fakeEmbedder());

    await pipeline.extractAndStore('user-1', [
      { role: 'user', content: 'I prefer dark mode for everything I work on.' },
      { role: 'assistant', content: 'Noted, switching to dark mode.' },
    ]);

    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0]?.content).toMatch(/prefer dark mode/);
    expect(repo.saved[0]?.source).toBe('conversation');
  });

  it('ignores assistant messages and short user messages', async () => {
    const repo = fakeMemoryRepo();
    const pipeline = new MemoryPipeline(repo, fakeEmbedder());

    await pipeline.extractAndStore('user-1', [
      { role: 'assistant', content: 'I prefer dark mode, a long enough sentence.' },
      { role: 'user', content: 'hi' },
    ]);

    expect(repo.saved).toHaveLength(0);
  });

  it('persists nothing when there are no memorable statements', async () => {
    const repo = fakeMemoryRepo();
    const pipeline = new MemoryPipeline(repo, fakeEmbedder());

    await pipeline.extractAndStore('user-1', [
      { role: 'user', content: 'What is the weather like in Tokyo today?' },
    ]);

    expect(repo.saved).toHaveLength(0);
  });

  it('honours a configurable minimum importance', async () => {
    const repo = fakeMemoryRepo();
    const pipeline = new MemoryPipeline(repo, fakeEmbedder());

    await pipeline.extractAndStore(
      'user-1',
      [{ role: 'user', content: 'Please remember that I prefer tabs over spaces.' }],
      { minImportance: 80 },
    );

    expect(repo.saved[0]?.importance).toBe(80);
  });
});
