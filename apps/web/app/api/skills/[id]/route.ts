import type { Skill } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';
import { UpdateSkillRequestBodySchema } from '@wolfkrow/shared-types';
import { DeleteSkillUseCase, GetSkillUseCase, UpdateSkillUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

interface Params { params: Promise<{ id: string }>; }

export async function GET(_request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { skill } = await new GetSkillUseCase(getRepos().skill).execute({ id, userId: session.userId });
    return Response.json({ skill: skill.toProps() });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function PUT(request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(UpdateSkillRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const repo = getRepos().skill;
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.content !== undefined) patch.content = body.content;
  if (body.tags !== undefined) patch.tags = body.tags;

  const { skill } = await new UpdateSkillUseCase(repo).execute({ id, ...patch });
  return Response.json({ skill: (skill as Skill).toProps() });
}

export async function DELETE(_request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const repo = getRepos().skill;
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await new DeleteSkillUseCase(repo).execute({ id });
  return new Response(null, { status: 204 });
}
