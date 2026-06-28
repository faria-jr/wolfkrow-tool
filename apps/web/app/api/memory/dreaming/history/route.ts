import { ListCompactionLogUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await new ListCompactionLogUseCase(getRepos().compactionLog).execute({
    userId: session.userId,
  });
  return Response.json({ log: result.log.map((l) => l.toProps()) });
}
