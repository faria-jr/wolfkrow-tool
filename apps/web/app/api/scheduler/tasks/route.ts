import { CreateScheduledTaskRequestBodySchema } from '@wolfkrow/shared-types';
import { CreateScheduledTaskUseCase, ListScheduledTasksUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const repo = getRepos().scheduledTask;
  const { tasks } = await new ListScheduledTasksUseCase(repo).execute({ userId: session.userId });
  return Response.json({ tasks: tasks.map((t) => t.toProps()) });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(CreateScheduledTaskRequestBodySchema, await req.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().scheduledTask;
  const uc = new CreateScheduledTaskUseCase(repo);
  const result = await uc.execute({
    userId: session.userId,
    name: body.name,
    cronExpression: body.cronExpression,
    prompt: body.prompt,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
  });

  return Response.json({ task: result.task.toProps() }, { status: 201 });
}
