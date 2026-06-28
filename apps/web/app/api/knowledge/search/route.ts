/**
 * POST /api/knowledge/search — hybrid semantic + keyword search
 */

import { SearchQuerySchema } from '@wolfkrow/shared-types';
import { SearchKnowledgeUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(SearchQuerySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const uc = new SearchKnowledgeUseCase(getRepos().knowledgeChunk, getAdapters().embedder);

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
