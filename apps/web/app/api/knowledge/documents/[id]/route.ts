/**
 * DELETE /api/knowledge/documents/:id — delete document + cascaded chunks
 */

import { DrizzleKnowledgeChunkRepo, DrizzleKnowledgeDocRepo } from '@wolfkrow/infra';
import { DeleteDocumentUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await new DeleteDocumentUseCase(
    new DrizzleKnowledgeDocRepo(),
    new DrizzleKnowledgeChunkRepo(),
  ).execute({ documentId: id, userId: session.userId });

  return Response.json({ deleted: true });
}
