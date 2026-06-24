import { ReviewTaskRunRequestBodySchema } from '@wolfkrow/shared-types';
import { ReviewTaskRunUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(ReviewTaskRunRequestBodySchema, await req.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().taskRun;
  const uc = new ReviewTaskRunUseCase(repo);
  const result = await uc.execute({
    runId: id,
    verdict: body.verdict,
    ...(body.note !== undefined ? { note: body.note } : {}),
  });

  return Response.json({ run: result.run.toProps() });
}
