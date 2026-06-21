/**
 * Knowledge routes — ingest, search, list, delete documents.
 * N.4: SPEC-004 ingest pipeline with parse→chunk→embed→store.
 */

import { z } from 'zod';
import {
  DrizzleKnowledgeChunkRepo,
  DrizzleKnowledgeDocRepo,
  VoyageEmbedder,
} from '@wolfkrow/infra';
import {
  DeleteDocumentUseCase,
  IngestDocumentUseCase,
  ListDocumentsUseCase,
  SearchKnowledgeUseCase,
} from '@wolfkrow/use-cases';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { AuthFastifyInstance } from '../types/fastify';
import { parseByMimeType } from '../knowledge/parsers/index';
import { semanticChunk, rawChunk } from '../knowledge/chunker';
import { validate } from '../validation';

const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'] ?? '';

const searchBody = z.object({
  query: z.string().min(1).max(512),
  limit: z.number().int().min(1).max(100).optional(),
  documentIds: z.array(z.string().max(128)).max(50).optional(),
});

function makeEmbedder() {
  return new VoyageEmbedder(VOYAGE_API_KEY);
}

function makeRepos() {
  return {
    docRepo: new DrizzleKnowledgeDocRepo(),
    chunkRepo: new DrizzleKnowledgeChunkRepo(),
  };
}

export async function knowledgeRoutes(app: AuthFastifyInstance) {
  const tmpDir = join(tmpdir(), 'wolfkrow-uploads');
  await mkdir(tmpDir, { recursive: true });

  app.post('/knowledge/upload', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const tmpPath = join(tmpDir, `${randomUUID()}-${data.filename}`);
    await pipeline(data.file, createWriteStream(tmpPath));

    const { readFile } = await import('node:fs/promises');
    let buffer: Buffer;
    try {
      buffer = await readFile(tmpPath);
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }

    const parsed = await parseByMimeType(buffer, data.mimetype, data.filename);
    const chunks = parsed.text.includes('#')
      ? semanticChunk(parsed.text)
      : rawChunk(parsed.text);

    if (chunks.length === 0) {
      return reply.code(422).send({ error: 'No content could be extracted from file' });
    }

    const { docRepo, chunkRepo } = makeRepos();
    const uc = new IngestDocumentUseCase(docRepo, chunkRepo, makeEmbedder());

    const result = await uc.execute({
      userId,
      filename: data.filename,
      mimeType: data.mimetype,
      size: buffer.byteLength,
      chunks,
    });

    return reply.send({ document: result.document.toProps() });
  });

  app.get('/knowledge/documents', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { docRepo } = makeRepos();
    const uc = new ListDocumentsUseCase(docRepo);
    const result = await uc.execute({ userId });
    return reply.send({ documents: result.documents.map((d) => d.toProps()) });
  });

  app.delete<{ Params: { id: string } }>('/knowledge/documents/:id', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const userId = (req as unknown as { user: { userId: string } }).user.userId;
    const { docRepo, chunkRepo } = makeRepos();
    const uc = new DeleteDocumentUseCase(docRepo, chunkRepo);
    await uc.execute({ documentId: req.params.id, userId });
    return reply.send({ deleted: true });
  });

  app.post<{ Body: unknown }>('/knowledge/search', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const { query, limit, documentIds } = validate(searchBody, req.body);

    const { chunkRepo } = makeRepos();
    const uc = new SearchKnowledgeUseCase(chunkRepo, makeEmbedder());
    const result = await uc.execute({
      userId: (req as unknown as { user: { userId: string } }).user.userId,
      query,
      ...(limit !== undefined ? { limit } : {}),
      ...(documentIds !== undefined ? { documentIds } : {}),
    });

    return reply.send({
      results: result.results.map((r) => ({
        chunkId: r.chunk.id,
        documentId: r.documentId,
        content: r.chunk.content,
        score: r.score,
        metadata: r.chunk.metadata,
      })),
      query: result.query,
    });
  });
}
