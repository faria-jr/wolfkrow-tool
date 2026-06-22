import type { Skill } from '@wolfkrow/domain';
import { UpdateSkillUseCase, DeleteSkillUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

interface Params { params: Promise<{ id: string }>; }

export async function PUT(request: Request, { params }: Params) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const repo = getRepos().skill;
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== session.userId) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.description !== undefined) patch.description = String(body.description);
  if (body.content !== undefined) patch.content = String(body.content);
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
