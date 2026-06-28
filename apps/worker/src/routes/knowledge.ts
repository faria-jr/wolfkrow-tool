/**
 * Knowledge routes — ingest, search, list, delete documents.
 * N.4: SPEC-004 ingest pipeline with parse→chunk→embed→store.
 */

import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { SearchQuerySchema } from '@wolfkrow/shared-types';
import {
  DeleteDocumentUseCase,
  IngestDocumentUseCase,
  ListDocumentsUseCase,
  SearchKnowledgeUseCase,
} from '@wolfkrow/use-cases';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { getAdapters, getRepos } from '../container';
import { semanticChunk, rawChunk } from '../knowledge/chunker';
import { parseByMimeType } from '../knowledge/parsers/index';
import type { AuthFastifyInstance } from '../types/fastify';
import { validate } from '../validation';

function makeEmbedder() {
  return getAdapters().embedder;
}

function makeRepos() {
  const r = getRepos();
  return {
    docRepo: r.knowledgeDoc,
    chunkRepo: r.knowledgeChunk,
  };
}

async function readAndDeleteTmp(tmpPath: string): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  try {
    return await readFile(tmpPath);
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}

async function handleKnowledgeUpload(req: FastifyRequest, reply: FastifyReply, tmpDir: string) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const data = await req.file();
  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

  const tmpPath = join(tmpDir, `${randomUUID()}-${data.filename}`);
  await pipeline(data.file, createWriteStream(tmpPath));
  const buffer = await readAndDeleteTmp(tmpPath);

  const parsed = await parseByMimeType(buffer, data.mimetype, data.filename);
  const chunks = parsed.text.includes('#') ? semanticChunk(parsed.text) : rawChunk(parsed.text);
  if (chunks.length === 0)
    return reply.code(422).send({ error: 'No content could be extracted from file' });

  const { docRepo, chunkRepo } = makeRepos();
  const result = await new IngestDocumentUseCase(docRepo, chunkRepo, makeEmbedder()).execute({
    userId,
    filename: data.filename,
    mimeType: data.mimetype,
    size: buffer.byteLength,
    chunks,
  });
  return reply.send({ document: result.document.toProps() });
}

async function listDocumentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const { docRepo } = makeRepos();
  const uc = new ListDocumentsUseCase(docRepo);
  const result = await uc.execute({ userId });
  return reply.send({ documents: result.documents.map((d) => d.toProps()) });
}

async function deleteDocumentHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const { docRepo, chunkRepo } = makeRepos();
  const uc = new DeleteDocumentUseCase(docRepo, chunkRepo);
  await uc.execute({ documentId: req.params.id, userId });
  return reply.send({ deleted: true });
}

async function searchKnowledgeHandler(
  req: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const { query, limit, documentIds } = validate(SearchQuerySchema, req.body);

  const { chunkRepo } = makeRepos();
  const adapters = getAdapters();
  const uc = new SearchKnowledgeUseCase(
    chunkRepo,
    makeEmbedder(),
    adapters.reranker,
    adapters.hyde
  );
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
}

export async function knowledgeRoutes(app: AuthFastifyInstance) {
  const tmpDir = join(tmpdir(), 'wolfkrow-uploads');
  await mkdir(tmpDir, { recursive: true });

  app.post(
    '/knowledge/upload',
    { onRequest: [app.authenticate] },
    async (req, reply) => handleKnowledgeUpload(req, reply, tmpDir)
  );

  app.get(
    '/knowledge/documents',
    { onRequest: [app.authenticate] },
    listDocumentsHandler
  );

  app.delete<{ Params: { id: string } }>(
    '/knowledge/documents/:id',
    { onRequest: [app.authenticate] },
    deleteDocumentHandler
  );

  app.post<{ Body: unknown }>(
    '/knowledge/search',
    { onRequest: [app.authenticate] },
    searchKnowledgeHandler
  );
}
