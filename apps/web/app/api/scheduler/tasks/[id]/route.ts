import { UpdateScheduledTaskRequestBodySchema } from '@wolfkrow/shared-types';
import { DeleteScheduledTaskUseCase, UpdateScheduledTaskUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(UpdateScheduledTaskRequestBodySchema, await req.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().scheduledTask;
  const uc = new UpdateScheduledTaskUseCase(repo);
  const result = await uc.execute({
    taskId: id,
    userId: session.userId,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.cronExpression !== undefined ? { cronExpression: body.cronExpression } : {}),
    ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
    ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
  });
  return Response.json({ task: result.task.toProps() });
}

export async function DELETE(_req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = getRepos().scheduledTask;
  await new DeleteScheduledTaskUseCase(repo).execute({ taskId: id, userId: session.userId });
  return Response.json({ deleted: true });
}
