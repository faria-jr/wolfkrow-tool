import { DrizzleSemanticMemoryRepo } from '@wolfkrow/infra';
import { DeleteMemoryUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = new DrizzleSemanticMemoryRepo();
  const uc = new DeleteMemoryUseCase(repo);
  await uc.execute({ memoryId: id, userId: session.userId });
  return Response.json({ deleted: true });
}
