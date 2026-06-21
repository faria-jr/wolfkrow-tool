import type { EmbeddingPort, MemorySearchResult, SemanticMemoryRepo } from '@wolfkrow/domain';

export interface SearchMemoryInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface SearchMemoryOutput {
  results: MemorySearchResult[];
}

export class SearchMemoryUseCase {
  constructor(
    private readonly repo: SemanticMemoryRepo,
    private readonly embedder: EmbeddingPort,
  ) {}

  async execute(input: SearchMemoryInput): Promise<SearchMemoryOutput> {
    if (!input.query.trim()) return { results: [] };
    const embedding = await this.embedder.embed(input.query);
    const results = await this.repo.vectorSearch(embedding, input.userId, input.limit ?? 10);
    return { results };
  }
}
