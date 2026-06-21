import type { MemorySource } from '@wolfkrow/domain';
import { DrizzleSemanticMemoryRepo, VoyageEmbedder } from '@wolfkrow/infra';
import { AddMemoryUseCase, ListMemoriesUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'] ?? '';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = new DrizzleSemanticMemoryRepo();
  const { memories } = await new ListMemoriesUseCase(repo).execute({ userId: session.userId });
  return Response.json({ memories: memories.map((m) => m.toProps()) });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    content?: string;
    source?: MemorySource;
    importance?: number;
    metadata?: Record<string, unknown>;
  };
  if (!body.content) return Response.json({ error: 'content required' }, { status: 400 });

  const repo = new DrizzleSemanticMemoryRepo();
  const embedder = new VoyageEmbedder(VOYAGE_API_KEY);
  const uc = new AddMemoryUseCase(repo, embedder);
  const result = await uc.execute({
    userId: session.userId,
    content: body.content,
    source: body.source ?? 'user',
    importance: body.importance ?? 50,
    ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
  });

  return Response.json({ memory: result.memory.toProps() }, { status: 201 });
}
