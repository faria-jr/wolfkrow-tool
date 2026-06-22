import type { Skill } from '@wolfkrow/domain';
import { CreateSkillUseCase, ListSkillsUseCase } from '@wolfkrow/use-cases';
import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth';
import { getRepos } from '@/lib/container';

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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const { skill } = await new CreateSkillUseCase(getRepos().skill).execute({
    userId: session.userId,
    name: String(body.name ?? ''),
    description: String(body.description ?? ''),
    content: String(body.content ?? ''),
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    isBuiltIn: false,
  });
  return Response.json({ skill: skill.toProps() }, { status: 201 });
}
