/**
 * GET /api/knowledge/documents — list documents for authenticated user
 */

import { ListDocumentsUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { documents } = await new ListDocumentsUseCase(getRepos().knowledgeDoc).execute({
    userId: session.userId,
  });

  return Response.json({ documents: documents.map((d) => d.toProps()) });
}
