import { CreateScheduledTaskUseCase, ListScheduledTasksUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

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

  const body = (await req.json()) as {
    name?: string;
    description?: string;
    cronExpression?: string;
    prompt?: string;
    agentId?: string;
    tags?: string[];
  };

  if (!body.name || !body.cronExpression || !body.prompt) {
    return Response.json({ error: 'name, cronExpression, and prompt are required' }, { status: 400 });
  }

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
