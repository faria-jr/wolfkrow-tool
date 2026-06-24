import type { Skill } from '@wolfkrow/domain';
import { CreateSkillRequestBodySchema } from '@wolfkrow/shared-types';
import { CreateSkillUseCase, ListSkillsUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { skills } = await new ListSkillsUseCase(getRepos().skill).execute({ userId: session.userId });
  return Response.json({ skills: skills.map((s: Skill) => s.toProps()) });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = validateBody(CreateSkillRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  const { skill } = await new CreateSkillUseCase(getRepos().skill).execute({
    userId: session.userId,
    name: body.name ?? '',
    description: body.description ?? '',
    content: body.content ?? '',
    tags: body.tags ?? [],
    isBuiltIn: false,
  });
  return Response.json({ skill: skill.toProps() }, { status: 201 });
}
