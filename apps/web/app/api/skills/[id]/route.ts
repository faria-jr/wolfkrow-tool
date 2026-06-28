import type { Skill } from '@wolfkrow/domain';
import { NotFoundError } from '@wolfkrow/domain';
import { UpdateSkillRequestBodySchema } from '@wolfkrow/shared-types';
import type { UpdateSkillRequestBody } from '@wolfkrow/shared-types';
import { DeleteSkillUseCase, GetSkillUseCase, OverrideSkillUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

interface Params {
  params: Promise<{ id: string }>;
}

async function requireSession() {
  const cookieStore = await cookies();
  return getSession(cookieStore.get('session')?.value);
}

async function findEditableSkill(id: string, userId: string) {
  const repo = getRepos().skill;
  const existing = await repo.findById(id);
  // Allow editing user-owned skills, custom skills, OR built-in (system) skills.
  // Built-ins are forked into a user-scoped override by OverrideSkillUseCase
  // rather than mutated in place, so the original is preserved.
  if (!existing) return null;
  if (existing.userId !== userId && existing.userId !== 'system') return null;
  return { repo, existing };
}

function buildPatch(body: UpdateSkillRequestBody): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.content !== undefined) patch.content = body.content;
  if (body.tags !== undefined) patch.tags = body.tags;
  return patch;
}

export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { skill } = await new GetSkillUseCase(getRepos().skill).execute({
      id,
      userId: session.userId,
    });
    return Response.json({ skill: skill.toProps() });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function PUT(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = validateBody(UpdateSkillRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const editable = await findEditableSkill(id, session.userId);
  if (!editable) return Response.json({ error: 'Not found' }, { status: 404 });

  const { skill } = await new OverrideSkillUseCase(editable.repo).execute({
    id,
    userId: session.userId,
    patch: buildPatch(body),
  });
  return Response.json({ skill: (skill as Skill).toProps() });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const editable = await findEditableSkill(id, session.userId);
  if (!editable) return Response.json({ error: 'Not found' }, { status: 404 });

  await new DeleteSkillUseCase(editable.repo).execute({ id });
  return new Response(null, { status: 204 });
}
