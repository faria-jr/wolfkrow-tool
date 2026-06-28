import { NotFoundError } from '@wolfkrow/domain';
import type { KnowledgeChunkRepo, KnowledgeDocRepo } from '@wolfkrow/domain';

import type { UseCase } from '../use-case';

export interface DeleteDocumentInput {
  documentId: string;
  userId: string;
}

export interface DeleteDocumentOutput {
  deleted: boolean;
}

export class DeleteDocumentUseCase implements UseCase<DeleteDocumentInput, DeleteDocumentOutput> {
  constructor(
    private readonly docRepo: KnowledgeDocRepo,
    private readonly chunkRepo: KnowledgeChunkRepo
  ) {}

  async execute(input: DeleteDocumentInput): Promise<DeleteDocumentOutput> {
    const doc = await this.docRepo.findById(input.documentId);
    if (!doc) throw new NotFoundError('KnowledgeDocument', input.documentId);

    await this.chunkRepo.deleteByDocumentId(input.documentId);
    await this.docRepo.delete(input.documentId);

    return { deleted: true };
  }
}
