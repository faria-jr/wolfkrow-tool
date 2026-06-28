import {
  type UpdateScheduledTaskRequestBody,
  UpdateScheduledTaskRequestBodySchema,
} from '@wolfkrow/shared-types';
import {
  DeleteScheduledTaskUseCase,
  UpdateScheduledTaskUseCase,
  type UpdateScheduledTaskInput,
} from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

/**
 * Project only the fields present on the validated request body into the
 * use-case input. Keeping this spread logic out of PATCH keeps the handler
 * under the cyclomatic-complexity limit (each `!== undefined` ternary is a
 * branch that would otherwise count against the route handler).
 */
function buildScheduledTaskUpdate(
  taskId: string,
  userId: string,
  body: UpdateScheduledTaskRequestBody
): UpdateScheduledTaskInput {
  return {
    taskId,
    userId,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.cronExpression !== undefined ? { cronExpression: body.cronExpression } : {}),
    ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
    ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
  };
}

export async function PATCH(req: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(
    UpdateScheduledTaskRequestBodySchema,
    await req.json().catch(() => null)
  );
  if (body instanceof Response) return body;

  const repo = getRepos().scheduledTask;
  const result = await new UpdateScheduledTaskUseCase(repo).execute(
    buildScheduledTaskUpdate(id, session.userId, body)
  );
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
