/**
 * DELETE /api/knowledge/documents/:id — delete document + cascaded chunks
 */

import { DeleteDocumentUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repos = getRepos();
  await new DeleteDocumentUseCase(repos.knowledgeDoc, repos.knowledgeChunk).execute({
    documentId: id,
    userId: session.userId,
  });

  return Response.json({ deleted: true });
}
