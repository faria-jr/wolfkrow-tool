import type { KnowledgeDocument, KnowledgeDocRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface ListDocumentsInput {
  userId: string;
}

export interface ListDocumentsOutput {
  documents: KnowledgeDocument[];
}

export class ListDocumentsUseCase implements UseCase<ListDocumentsInput, ListDocumentsOutput> {
  constructor(private readonly docRepo: KnowledgeDocRepo) {}

  async execute(input: ListDocumentsInput): Promise<ListDocumentsOutput> {
    const documents = await this.docRepo.findByUserId(input.userId);
    return { documents };
  }
}
