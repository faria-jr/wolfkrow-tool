import { CreateMemoryRequestBodySchema } from '@wolfkrow/shared-types';
import { AddMemoryUseCase, ListMemoriesUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getAdapters, getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = getRepos().semanticMemory;
  const { memories } = await new ListMemoriesUseCase(repo).execute({ userId: session.userId });
  return Response.json({ memories: memories.map((m) => m.toProps()) });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(CreateMemoryRequestBodySchema, await req.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().semanticMemory;
  const embedder = getAdapters().embedder;
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
