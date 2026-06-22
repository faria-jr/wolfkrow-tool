import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const runs = await getRepos().taskRun.findAwaitingReview(session.userId);
  return Response.json({ runs: runs.map((r) => r.toProps()), count: runs.length });
}
