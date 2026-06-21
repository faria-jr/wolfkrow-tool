/**
 * POST /api/knowledge/search — hybrid semantic + keyword search
 */

import { DrizzleKnowledgeChunkRepo, VoyageEmbedder } from '@wolfkrow/infra';
import { SearchKnowledgeUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

interface SearchBody {
  query: string;
  limit?: number;
  documentIds?: string[];
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SearchBody | null;
  if (!body?.query) return Response.json({ error: 'query required' }, { status: 400 });

  const apiKey = process.env['VOYAGE_API_KEY'] ?? '';
  const uc = new SearchKnowledgeUseCase(
    new DrizzleKnowledgeChunkRepo(),
    new VoyageEmbedder(apiKey),
  );

  const result = await uc.execute({
    userId: session.userId,
    query: body.query,
    ...(body.limit !== undefined ? { limit: body.limit } : {}),
    ...(body.documentIds !== undefined ? { documentIds: body.documentIds } : {}),
  });

  return Response.json({
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
