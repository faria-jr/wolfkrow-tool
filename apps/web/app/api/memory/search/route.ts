import { DrizzleSemanticMemoryRepo, VoyageEmbedder } from '@wolfkrow/infra';
import { SearchMemoryUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'] ?? '';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { query?: string; limit?: number };
  if (!body.query) return Response.json({ error: 'query required' }, { status: 400 });

  const repo = new DrizzleSemanticMemoryRepo();
  const embedder = new VoyageEmbedder(VOYAGE_API_KEY);
  const uc = new SearchMemoryUseCase(repo, embedder);
  const result = await uc.execute({
    userId: session.userId,
    query: body.query,
    ...(body.limit !== undefined ? { limit: body.limit } : {}),
  });

  return Response.json({
    results: result.results.map((r) => ({
      memory: r.memory.toProps(),
      distance: r.distance,
    })),
  });
}
