import { DrizzleTaskRunRepo } from '@wolfkrow/infra';
import { ReviewTaskRunUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { verdict?: 'validated' | 'rejected'; note?: string };

  if (!body.verdict || !['validated', 'rejected'].includes(body.verdict)) {
    return Response.json({ error: 'verdict must be "validated" or "rejected"' }, { status: 400 });
  }

  const repo = new DrizzleTaskRunRepo();
  const uc = new ReviewTaskRunUseCase(repo);
  const result = await uc.execute({
    runId: id,
    verdict: body.verdict,
    ...(body.note !== undefined ? { note: body.note } : {}),
  });

  return Response.json({ run: result.run.toProps() });
}
